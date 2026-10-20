package com.creative.studio;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import javax.crypto.*;
import javax.crypto.spec.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.*;
import java.time.*;
import java.util.*;
import java.util.zip.ZipInputStream;

/** One private team library. Every path is generated/validated; no public file URLs. */
@Service
@Profile("corporate")
public class EncryptedWorkspace {
    static final int META_LIMIT=524288, BLOB_LIMIT=25*1024*1024;
    static final long REQUEST_LIMIT=160L*1024*1024;
    private final Path root;
    private final ObjectMapper mapper;
    private final SecretKeySpec key;
    private final SecureRandom random=new SecureRandom();
    private final long quota;
    private final int userAttempts,teamAttempts;
    private final Clock clock;
    public record Stored(long version,JsonNode record,String author,String updatedAt) {}
    record Ref(String type,long size) {}
    @org.springframework.beans.factory.annotation.Autowired
    public EncryptedWorkspace(ObjectMapper mapper,@Value("${creative.workspace.directory}") String directory,
            @Value("${creative.workspace.key}") String secret,@Value("${creative.workspace.quota-bytes}") long quota,
            @Value("${creative.corporate.daily-user-attempts}") int userAttempts,@Value("${creative.corporate.daily-team-attempts}") int teamAttempts) {
        this(mapper,Path.of(directory),secret,quota,userAttempts,teamAttempts,Clock.systemUTC());
    }
    EncryptedWorkspace(ObjectMapper mapper,Path root,String secret,long quota,int userAttempts,int teamAttempts,Clock clock) {
        this.mapper=mapper;this.root=root.toAbsolutePath().normalize();this.quota=quota;this.userAttempts=userAttempts;this.teamAttempts=teamAttempts;this.clock=clock;
        if(secret.length()<32)throw new IllegalStateException("Set a random STUDIO_STORAGE_KEY of at least 32 characters in the hosting secret manager.");
        if(quota<REQUEST_LIMIT||userAttempts<1||teamAttempts<1)throw new IllegalStateException("Configure positive workspace and AI attempt limits.");
        try {
            this.key=new SecretKeySpec(MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8)),"AES");
            privateDirectory(this.root);
            var marker=this.root.resolve("key-check.bin");
            if(Files.exists(marker)) {
                if(!Arrays.equals(decrypt(marker,"key-check",64),"studio-private-v1".getBytes(StandardCharsets.UTF_8)))throw new IOException("Storage key mismatch");
            } else atomicEncrypt(marker,"key-check","studio-private-v1".getBytes(StandardCharsets.UTF_8));
        }catch(Exception error){throw new IllegalStateException("Private storage cannot be opened. Check the mounted directory and original storage key; existing data was not replaced.");}
    }
    static void privateDirectory(Path path) throws IOException {
        Files.createDirectories(path);
        if(Files.isSymbolicLink(path))throw new IOException("Symbolic links are not allowed");
        try{Files.setPosixFilePermissions(path,PosixFilePermissions.fromString("rwx------"));}catch(UnsupportedOperationException ignored){}
    }
    static String id(String value) {
        try{if(!UUID.fromString(value).toString().equals(value))throw new IllegalArgumentException();return value;}
        catch(Exception error){throw bad("Invalid workspace identifier.");}
    }
    static String store(String value) {
        if(!Set.of("projects","drafts","runs").contains(value))throw bad("Unknown workspace collection.");return value;
    }
    Path directory(String collection,String recordId){return root.resolve(store(collection)).resolve(id(recordId));}
    String aad(String collection,String recordId,String file){return collection+"/"+recordId+"/"+file;}
    static ResponseStatusException bad(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
    static ResponseStatusException missing(){return new ResponseStatusException(HttpStatus.NOT_FOUND,"The shared record or file is not available.");}
    static ResponseStatusException conflict(){return new ResponseStatusException(HttpStatus.CONFLICT,"A colleague updated this record. Reload the project before editing again.");}
    Cipher cipher(int mode,byte[] iv,String context) throws GeneralSecurityException {
        var cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(mode,key,new GCMParameterSpec(128,iv));cipher.updateAAD(context.getBytes(StandardCharsets.UTF_8));return cipher;
    }
    OutputStream encryptedOutput(Path path,String context) throws IOException,GeneralSecurityException {
        byte[] iv=new byte[12];random.nextBytes(iv);
        var output=Files.newOutputStream(path,StandardOpenOption.CREATE_NEW);output.write(1);output.write(iv);
        return new CipherOutputStream(output,cipher(Cipher.ENCRYPT_MODE,iv,context));
    }
    byte[] decrypt(Path path,String context,int maximum) throws IOException,GeneralSecurityException {
        if(Files.isSymbolicLink(path)||Files.size(path)>maximum+64L)throw new IOException("Invalid encrypted file");
        byte[] bytes=Files.readAllBytes(path);if(bytes.length<29||bytes[0]!=1)throw new IOException("Invalid encrypted file");
        return cipher(Cipher.DECRYPT_MODE,Arrays.copyOfRange(bytes,1,13),context).doFinal(bytes,13,bytes.length-13);
    }
    void atomicEncrypt(Path destination,String context,byte[] value) throws IOException,GeneralSecurityException {
        privateDirectory(destination.getParent());var temporary=destination.resolveSibling(UUID.randomUUID()+".tmp");
        try {try(var output=encryptedOutput(temporary,context)){output.write(value);}Files.move(temporary,destination,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}
        finally{Files.deleteIfExists(temporary);}
    }
    Stored read(String collection,String recordId) throws IOException,GeneralSecurityException {
        var path=directory(collection,recordId).resolve("record.bin");if(!Files.exists(path))throw missing();
        return mapper.readValue(decrypt(path,aad(collection,recordId,"record"),META_LIMIT),Stored.class);
    }
    public synchronized Stored get(String collection,String recordId) throws IOException,GeneralSecurityException {
        var saved=read(collection,recordId);
        if(collection.equals("runs")&&saved.record().path("status").asText().equals("running")&&Instant.parse(saved.updatedAt()).isBefore(clock.instant().minus(Duration.ofMinutes(15)))) {
            ObjectNode interrupted=saved.record().deepCopy();interrupted.put("status","interrupted");interrupted.put("error","The generating page stopped sending progress for 15 minutes. Completed files were kept.");
            for(var output:interrupted.path("outputs"))if(output.path("status").asText().equals("pending"))((ObjectNode)output).put("status","interrupted");
            saved=new Stored(saved.version()+1,interrupted,saved.author(),clock.instant().toString());
            atomicEncrypt(directory(collection,recordId).resolve("record.bin"),aad(collection,recordId,"record"),mapper.writeValueAsBytes(saved));
        }
        return saved;
    }
    public synchronized List<Stored> all(String collection) throws IOException,GeneralSecurityException {
        var parent=root.resolve(store(collection));if(!Files.exists(parent))return List.of();var result=new ArrayList<Stored>();
        try(var entries=Files.list(parent)){for(var entry:entries.toList())if(Files.isDirectory(entry)&&Files.exists(entry.resolve("record.bin")))result.add(get(collection,entry.getFileName().toString()));}
        return result;
    }
    void references(JsonNode value,Map<String,Ref> result) {
        if(value.isObject()&&value.has("__studioBlob")) {
            var name=id(value.path("__studioBlob").asText());var type=value.path("type").asText();long size=value.path("size").asLong(-1);
            if(!Set.of("image/png","image/jpeg","image/webp").contains(type)||size<1||size>BLOB_LIMIT)throw bad("Unsupported image reference.");
            var ref=new Ref(type,size);if(result.containsKey(name)&&!result.get(name).equals(ref))throw bad("Conflicting image references.");result.put(name,ref);
        } else if(value.isContainerNode())value.forEach(child->references(child,result));
    }
    static boolean signature(byte[] prefix,String type) {
        return switch(type){
            case "image/png"->prefix.length>=8&&Arrays.equals(Arrays.copyOf(prefix,8),new byte[]{(byte)137,80,78,71,13,10,26,10});
            case "image/jpeg"->prefix.length>=3&&(prefix[0]&255)==255&&(prefix[1]&255)==216&&(prefix[2]&255)==255;
            case "image/webp"->prefix.length>=12&&new String(prefix,0,4,StandardCharsets.US_ASCII).equals("RIFF")&&new String(prefix,8,4,StandardCharsets.US_ASCII).equals("WEBP");
            default->false;
        };
    }
    long usedBytes() throws IOException {try(var entries=Files.walk(root)){long total=0;for(var p:entries.filter(Files::isRegularFile).toList())total+=Files.size(p);return total;}}
    public synchronized Stored put(String collection,String recordId,long expected,String identity,InputStream request) throws IOException,GeneralSecurityException {
        var dir=directory(collection,recordId);Stored previous=Files.exists(dir.resolve("record.bin"))?read(collection,recordId):null;
        if((previous==null?0:previous.version())!=expected)throw conflict();
        if(collection.equals("runs")&&previous!=null&&(!previous.author().equals(identity)||!previous.record().path("status").asText().equals("running")))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the generating colleague can update an active run. Finished runs are immutable.");
        privateDirectory(dir);Path staging=dir.resolve("stage-"+UUID.randomUUID());privateDirectory(staging);
        var added=new ArrayList<Path>();boolean committed=false;
        try(var zip=new ZipInputStream(request,StandardCharsets.UTF_8)) {
            var first=zip.getNextEntry();if(first==null||!first.getName().equals("record.json"))throw bad("Workspace upload must start with its metadata.");
            byte[] json=zip.readNBytes(META_LIMIT+1);if(json.length>META_LIMIT)throw bad("Workspace metadata is too large.");
            JsonNode record=mapper.readTree(json);if(record==null||!record.isObject())throw bad("Invalid workspace metadata.");
            var keyField=collection.equals("drafts")?"projectId":"id";if(!recordId.equals(record.path(keyField).asText()))throw bad("Record identity does not match its URL.");
            if(!collection.equals("projects"))read("projects",id(record.path("projectId").asText()));
            var refs=new HashMap<String,Ref>();references(record,refs);if(refs.size()>64)throw bad("Too many images in this record.");
            var oldRefs=new HashMap<String,Ref>();if(previous!=null)references(previous.record(),oldRefs);
            var uploaded=new HashSet<String>();long total=json.length;int count=0;
            for(var entry=zip.getNextEntry();entry!=null;entry=zip.getNextEntry()) {
                if(++count>64||entry.isDirectory()||!entry.getName().startsWith("blobs/"))throw bad("Invalid workspace ZIP entry.");
                var blobId=id(entry.getName().substring(6));var ref=refs.get(blobId);
                if(ref==null||!uploaded.add(blobId)||oldRefs.containsKey(blobId))throw bad("Unexpected or duplicate image upload.");
                byte[] prefix=zip.readNBytes(12);long size=prefix.length;total+=prefix.length;
                if(!signature(prefix,ref.type()))throw bad("Upload must be a genuine PNG, JPEG or WebP image.");
                try(var out=encryptedOutput(staging.resolve(blobId),aad(collection,recordId,blobId))) {
                    out.write(prefix);byte[] buffer=new byte[65536];int read;
                    while((read=zip.read(buffer))!=-1){size+=read;total+=read;if(size>BLOB_LIMIT||total>REQUEST_LIMIT)throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Workspace upload exceeds its image/total limit.");out.write(buffer,0,read);}
                }
                if(size!=ref.size())throw bad("Image size does not match its reference.");
            }
            for(var item:refs.entrySet())if(!uploaded.contains(item.getKey())&&(!item.getValue().equals(oldRefs.get(item.getKey()))||!Files.isRegularFile(dir.resolve(item.getKey()))))throw bad("An image reference is missing or belongs to a different record.");
            if(usedBytes()+META_LIMIT>quota)throw new ResponseStatusException(HttpStatus.INSUFFICIENT_STORAGE,"The private library is full. Export and remove an old project or increase the server storage quota.");
            for(var blobId:uploaded){var target=dir.resolve(blobId);Files.move(staging.resolve(blobId),target,StandardCopyOption.ATOMIC_MOVE);added.add(target);}
            var saved=new Stored(expected+1,record,previous==null?identity:previous.author(),clock.instant().toString());
            byte[] encoded=mapper.writeValueAsBytes(saved);if(encoded.length>META_LIMIT)throw bad("Workspace metadata is too large.");
            atomicEncrypt(dir.resolve("record.bin"),aad(collection,recordId,"record"),encoded);committed=true;
            for(var old:oldRefs.keySet())if(!refs.containsKey(old))Files.deleteIfExists(dir.resolve(old));
            return saved;
        } finally {removeTree(staging);if(!committed)for(var file:added)Files.deleteIfExists(file);}
    }
    public synchronized byte[] blob(String collection,String recordId,String blobId) throws IOException,GeneralSecurityException {
        id(blobId);var refs=new HashMap<String,Ref>();references(get(collection,recordId).record(),refs);if(!refs.containsKey(blobId))throw missing();
        return decrypt(directory(collection,recordId).resolve(blobId),aad(collection,recordId,blobId),BLOB_LIMIT);
    }
    public synchronized String blobType(String collection,String recordId,String blobId) throws IOException,GeneralSecurityException {
        var refs=new HashMap<String,Ref>();references(get(collection,recordId).record(),refs);if(!refs.containsKey(id(blobId)))throw missing();return refs.get(blobId).type();
    }
    public synchronized void deleteProject(String projectId,long expected) throws IOException,GeneralSecurityException {
        var project=get("projects",projectId);if(project.version()!=expected)throw conflict();
        var children=all("runs").stream().filter(run->run.record().path("projectId").asText().equals(projectId)).toList();
        if(children.stream().anyMatch(run->run.record().path("status").asText().equals("running")))throw new ResponseStatusException(HttpStatus.CONFLICT,"Finish or cancel the active generation before deleting this shared project.");
        removeTree(directory("drafts",projectId));for(var run:children)removeTree(directory("runs",run.record().path("id").asText()));removeTree(directory("projects",projectId));
    }
    public synchronized void consumeAttempt(String identity) throws IOException,GeneralSecurityException {
        String today=LocalDate.now(clock.withZone(ZoneId.of("Europe/Kyiv"))).toString();Path path=root.resolve("usage.bin");ObjectNode usage;
        if(Files.exists(path))usage=(ObjectNode)mapper.readTree(decrypt(path,"usage",META_LIMIT));else usage=mapper.createObjectNode();
        if(!today.equals(usage.path("date").asText())){usage=mapper.createObjectNode();usage.put("date",today);usage.set("users",mapper.createObjectNode());usage.put("total",0);}
        String user=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(identity.getBytes(StandardCharsets.UTF_8)));
        ObjectNode users=(ObjectNode)usage.path("users");int count=users.path(user).asInt(),total=usage.path("total").asInt();
        if(count>=userAttempts||total>=teamAttempts)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"The daily AI attempt limit has been reached. Contact the project owner or try again tomorrow.");
        users.put(user,count+1);usage.put("total",total+1);atomicEncrypt(path,"usage",mapper.writeValueAsBytes(usage));
    }
    static void removeTree(Path path) throws IOException {
        if(!Files.exists(path))return;try(var entries=Files.walk(path)){for(var entry:entries.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(entry);}
    }
    ObjectNode object(){return mapper.createObjectNode();}
    synchronized ObjectNode setting(String name) throws IOException,GeneralSecurityException {
        if(!Set.of("access").contains(name))throw new IllegalArgumentException();var file=root.resolve(name+".bin");
        return Files.exists(file)?(ObjectNode)mapper.readTree(decrypt(file,"settings/"+name,META_LIMIT)):null;
    }
    synchronized void setting(String name,ObjectNode value) throws IOException,GeneralSecurityException {
        if(!Set.of("access").contains(name))throw new IllegalArgumentException();
        byte[] bytes=mapper.writeValueAsBytes(value);if(bytes.length>META_LIMIT)throw bad("The private access directory is full.");atomicEncrypt(root.resolve(name+".bin"),"settings/"+name,bytes);
    }
}
