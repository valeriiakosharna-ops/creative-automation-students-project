package com.creative.studio;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.server.ResponseStatusException;
import java.io.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.zip.*;
import static org.junit.jupiter.api.Assertions.*;

class EncryptedWorkspaceTest {
    @TempDir Path root;
    final ObjectMapper mapper=new ObjectMapper();
    static final String SECRET="test-only-random-shape-encryption-key-not-for-real-use";
    static final byte[] PNG=new byte[]{(byte)137,80,78,71,13,10,26,10,0,1,2,3,4};
    static byte[] upload(ObjectMapper mapper,Object record,Map<String,byte[]> blobs) throws IOException {
        var result=new ByteArrayOutputStream();try(var zip=new ZipOutputStream(result)) {
            zip.putNextEntry(new ZipEntry("record.json"));zip.write(mapper.writeValueAsBytes(record));zip.closeEntry();
            for(var blob:blobs.entrySet()){zip.putNextEntry(new ZipEntry("blobs/"+blob.getKey()));zip.write(blob.getValue());zip.closeEntry();}
        }return result.toByteArray();
    }
    EncryptedWorkspace storage(){return new EncryptedWorkspace(mapper,root,SECRET,512L*1024*1024,2,3,Clock.fixed(Instant.parse("2026-10-20T12:00:00Z"),ZoneOffset.UTC));}
    EncryptedWorkspace.Stored put(EncryptedWorkspace store,String collection,String id,long version,Object record,Map<String,byte[]> blobs) throws Exception {
        return store.put(collection,id,version,"google|owner-sub",new ByteArrayInputStream(upload(mapper,record,blobs)));
    }
    @Test void materialAndMetadataAreEncryptedPersistAcrossRestartAndRequireTheOriginalKey() throws Exception {
        var store=storage();String id=UUID.randomUUID().toString(),blob=UUID.randomUUID().toString();
        var record=Map.of("id",id,"name","Confidential event material", "image",Map.of("__studioBlob",blob,"type","image/png","size",PNG.length));
        put(store,"projects",id,0,record,Map.of(blob,PNG));
        assertArrayEquals(PNG,storage().blob("projects",id,blob));
        assertEquals("Confidential event material",storage().get("projects",id).record().path("name").asText());
        try(var files=Files.walk(root)){for(var file:files.filter(Files::isRegularFile).toList()) {
            byte[] raw=Files.readAllBytes(file);assertFalse(new String(raw,java.nio.charset.StandardCharsets.ISO_8859_1).contains("Confidential event material"));assertFalse(Arrays.equals(raw,PNG));
        }}
        assertThrows(IllegalStateException.class,()->new EncryptedWorkspace(mapper,root,"different-test-only-key-1234567890123456789",512L*1024*1024,2,3,Clock.systemUTC()));
        assertArrayEquals(PNG,storage().blob("projects",id,blob));
    }
    @Test void staleWritesCannotOverwriteAColleaguesChanges() throws Exception {
        var store=storage();String id=UUID.randomUUID().toString();
        put(store,"projects",id,0,Map.of("id",id,"name","First"),Map.of());
        put(store,"projects",id,1,Map.of("id",id,"name","Second"),Map.of());
        var error=assertThrows(ResponseStatusException.class,()->put(store,"projects",id,1,Map.of("id",id,"name","Stale"),Map.of()));
        assertEquals(409,error.getStatusCode().value());assertEquals("Second",store.get("projects",id).record().path("name").asText());
    }
    @Test void traversalMissingForeignBlobReferencesAndFakeImagesAreRejected() throws Exception {
        var store=storage();assertThrows(ResponseStatusException.class,()->store.get("projects","../private"));
        String id=UUID.randomUUID().toString(),blob=UUID.randomUUID().toString();
        var ref=Map.of("id",id,"image",Map.of("__studioBlob",blob,"type","image/png","size",PNG.length));
        assertThrows(ResponseStatusException.class,()->put(store,"projects",id,0,ref,Map.of()));
        assertThrows(ResponseStatusException.class,()->put(store,"projects",id,0,ref,Map.of(blob,new byte[PNG.length])));
        assertThrows(ResponseStatusException.class,()->store.blob("projects",id,blob));
    }
    @Test void changedCiphertextIsNotReturnedAsAValidMaterial() throws Exception {
        var store=storage();String id=UUID.randomUUID().toString(),blob=UUID.randomUUID().toString();
        put(store,"projects",id,0,Map.of("id",id,"image",Map.of("__studioBlob",blob,"type","image/png","size",PNG.length)),Map.of(blob,PNG));
        Path file=root.resolve("projects").resolve(id).resolve(blob);byte[] bytes=Files.readAllBytes(file);bytes[bytes.length-1]^=1;Files.write(file,bytes);
        assertThrows(java.security.GeneralSecurityException.class,()->store.blob("projects",id,blob));
    }
    @Test void persistedDailyAttemptLimitsSurviveProcessRestart() throws Exception {
        storage().consumeAttempt("one");storage().consumeAttempt("one");
        assertEquals(429,assertThrows(ResponseStatusException.class,()->storage().consumeAttempt("one")).getStatusCode().value());
        storage().consumeAttempt("two");assertEquals(429,assertThrows(ResponseStatusException.class,()->storage().consumeAttempt("three")).getStatusCode().value());
    }
    @Test void accessDirectoryIsPrivateRevocationIsImmediateAndOwnerCannotBeRemoved() throws Exception {
        var store=storage();var access=new AccessDirectory(store,"team.example","owner@team.example");
        assertTrue(access.authorize("google|owner","owner@team.example"));assertFalse(access.authorize("google|unknown","unknown@team.example"));
        access.change("google|owner","member@team.example",true);assertTrue(access.authorize("google|member","member@team.example"));
        assertFalse(access.authorize("google|recycled-email","member@team.example"));
        access.change("google|owner","member@team.example",false);assertFalse(access.authorize("google|member","member@team.example"));
        assertThrows(ResponseStatusException.class,()->access.change("google|owner","owner@team.example",false));
        assertThrows(ResponseStatusException.class,()->access.change("google|owner","outsider@another.example",true));
        assertFalse(new String(Files.readAllBytes(root.resolve("access.bin")),java.nio.charset.StandardCharsets.ISO_8859_1).contains("owner@team.example"));
        assertFalse(new AccessDirectory(storage(),"team.example","owner@team.example").authorize("google|member","member@team.example"));
    }
    @Test void activeRunsHaveOneWriterFinishedRunsAreImmutableAndAbandonedRunsRecoverBeforeCascadeDelete() throws Exception {
        var store=storage();String project=UUID.randomUUID().toString(),run=UUID.randomUUID().toString();
        put(store,"projects",project,0,Map.of("id",project),Map.of());
        put(store,"drafts",project,0,Map.of("projectId",project,"title","Saved draft"),Map.of());
        var record=Map.of("id",run,"projectId",project,"status","running","outputs",List.of(Map.of("status","complete"),Map.of("status","pending")));
        put(store,"runs",run,0,record,Map.of());
        assertEquals(403,assertThrows(ResponseStatusException.class,()->store.put("runs",run,1,"google|another",new ByteArrayInputStream(upload(mapper,record,Map.of())))).getStatusCode().value());
        assertEquals(409,assertThrows(ResponseStatusException.class,()->store.deleteProject(project,1)).getStatusCode().value());
        var later=new EncryptedWorkspace(mapper,root,SECRET,512L*1024*1024,2,3,Clock.fixed(Instant.parse("2026-10-20T12:16:00Z"),ZoneOffset.UTC));
        var recovered=later.get("runs",run);assertEquals("interrupted",recovered.record().path("status").asText());
        assertEquals("complete",recovered.record().path("outputs").get(0).path("status").asText());
        assertEquals("interrupted",recovered.record().path("outputs").get(1).path("status").asText());
        assertEquals(403,assertThrows(ResponseStatusException.class,()->put(later,"runs",run,2,record,Map.of())).getStatusCode().value());
        later.deleteProject(project,1);
        assertThrows(ResponseStatusException.class,()->later.get("drafts",project));assertThrows(ResponseStatusException.class,()->later.get("runs",run));
    }

}
