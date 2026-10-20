package com.creative.studio;

import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.http.HttpServletRequest;
import java.io.*;
import java.security.GeneralSecurityException;
import java.util.*;

@RestController
@Profile("corporate")
public class WorkspaceController {
    private final EncryptedWorkspace storage;
    private final CorporatePolicy policy;
    public WorkspaceController(EncryptedWorkspace storage,CorporatePolicy policy){this.storage=storage;this.policy=policy;}
    @GetMapping("/api/session") Map<String,Object> session(@AuthenticationPrincipal OidcUser user,CsrfToken csrf) {
        return Map.of("email",policy.email(user),"csrfToken",csrf.getToken(),"csrfHeader",csrf.getHeaderName(),"workspace","shared","canManageAccess",policy.canManage(user));
    }
    @GetMapping("/api/workspace/{collection}") List<EncryptedWorkspace.Stored> all(@PathVariable String collection) throws Exception{return storage.all(collection);}
    @GetMapping("/api/workspace/{collection}/{id}") EncryptedWorkspace.Stored get(@PathVariable String collection,@PathVariable String id) throws Exception{return storage.get(collection,id);}
    @PostMapping(value="/api/workspace/{collection}/{id}",consumes="application/zip") EncryptedWorkspace.Stored put(@PathVariable String collection,@PathVariable String id,
            @RequestHeader("If-Match") String version,@AuthenticationPrincipal OidcUser user,HttpServletRequest request) throws Exception {
        return storage.put(collection,id,version(version),policy.identity(user),request.getInputStream());
    }
    @GetMapping("/api/workspace/{collection}/{id}/blobs/{blob}") ResponseEntity<byte[]> blob(@PathVariable String collection,@PathVariable String id,@PathVariable String blob) throws Exception {
        String type=storage.blobType(collection,id,blob);byte[] bytes=storage.blob(collection,id,blob);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType(type))
            .header("Content-Disposition","attachment; filename=\"asset."+(type.equals("image/jpeg")?"jpg":type.equals("image/png")?"png":"webp")+"\"").body(bytes);
    }
    @DeleteMapping("/api/workspace/projects/{id}") void delete(@PathVariable String id,@RequestHeader("If-Match") String version) throws Exception {storage.deleteProject(id,version(version));}
    static long version(String value) {
        try{long version=Long.parseLong(value.replace("\"",""));if(version<0)throw new NumberFormatException();return version;}
        catch(NumberFormatException error){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use the record's current version.");}
    }
    @ExceptionHandler({IOException.class,GeneralSecurityException.class}) ResponseEntity<Map<String,String>> storageError(Exception error) {
        return ResponseEntity.status(503).body(Map.of("message","The encrypted library could not be read or saved. Contact the project owner; no unencrypted fallback was used."));
    }
}
