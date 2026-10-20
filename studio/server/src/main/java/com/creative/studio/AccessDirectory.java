package com.creative.studio;

import com.fasterxml.jackson.databind.node.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.*;

@Service
@Profile("corporate")
public class AccessDirectory {
    private final EncryptedWorkspace storage;
    private final String domain,owner;
    public AccessDirectory(EncryptedWorkspace storage,@Value("${creative.corporate.domain}") String domain,
            @Value("${creative.corporate.owner-email}") String owner) throws IOException,GeneralSecurityException {
        this.storage=storage;this.domain=domain.trim().toLowerCase(Locale.ROOT);this.owner=email(owner);
        synchronized(storage) {
            ObjectNode state=storage.setting("access");
            if(state==null) {
                state=storage.object();state.put("owner",this.owner);var members=state.putObject("members");
                var entry=members.putObject(this.owner);entry.put("active",true);entry.put("addedAt",Instant.now().toString());
                state.putArray("audit");storage.setting("access",state);
            } else if(!this.owner.equals(state.path("owner").asText()))throw new IllegalStateException("The configured owner does not match the encrypted access directory. No ownership change was applied.");
        }
    }
    String email(String value) {
        String result=value.trim().toLowerCase(Locale.ROOT);
        if(!result.matches("[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@"+java.util.regex.Pattern.quote(domain)))throw new IllegalArgumentException("Use an exact email address in the configured corporate domain.");
        return result;
    }
    public boolean authorize(String identity,String email) throws IOException,GeneralSecurityException {
        synchronized(storage) {
            var state=storage.setting("access");var entry=state.path("members").path(email);
            if(!entry.path("active").asBoolean())return false;
            String bound=entry.path("identity").asText();
            if(!bound.isEmpty())return bound.equals(identity);
            ((ObjectNode)entry).put("identity",identity);storage.setting("access",state);return true;
        }
    }
    public boolean owner(String identity,String email) throws IOException,GeneralSecurityException {return owner.equals(email)&&authorize(identity,email);}
    public List<Map<String,Object>> members() throws IOException,GeneralSecurityException {
        synchronized(storage) {
            var values=new ArrayList<Map<String,Object>>();var iterator=storage.setting("access").path("members").fields();
            while(iterator.hasNext()){var item=iterator.next();values.add(Map.of("email",item.getKey(),"owner",item.getKey().equals(owner),"active",item.getValue().path("active").asBoolean(),"addedAt",item.getValue().path("addedAt").asText()));}
            values.sort(Comparator.comparing(item->item.get("email").toString()));return values;
        }
    }
    public void change(String actor,String input,boolean active) throws IOException,GeneralSecurityException {
        final String target;try{target=email(input);}catch(IllegalArgumentException error){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter an email address in your corporate domain.");}
        if(target.equals(owner))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The owner cannot be removed or reassigned through colleague invitations.");
        synchronized(storage) {
            var state=storage.setting("access");var members=(ObjectNode)state.path("members");
            var previous=members.path(target);
            if(active&&previous.path("active").asBoolean())return;
            if(!active&&previous.isMissingNode())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"This colleague is not in the access list.");
            ObjectNode entry=active?storage.object():(ObjectNode)previous;
            entry.put("active",active);if(active)entry.put("addedAt",Instant.now().toString());else entry.put("revokedAt",Instant.now().toString());members.set(target,entry);
            var audit=(ArrayNode)state.path("audit");var event=audit.addObject();event.put("action",active?"grant":"revoke");event.put("actor",actor);event.put("email",target);event.put("at",Instant.now().toString());while(audit.size()>500)audit.remove(0);
            storage.setting("access",state);
        }
    }
}
