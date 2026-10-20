package com.creative.studio;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@RestController
@Profile("corporate")
@RequestMapping("/api/access")
public class AccessController {
    private final AccessDirectory access;
    private final CorporatePolicy policy;
    public AccessController(AccessDirectory access,CorporatePolicy policy){this.access=access;this.policy=policy;}
    record Colleague(@NotBlank @Size(max=254) @Email String email) {}
    void owner(OidcUser user) throws Exception {
        if(!access.owner(policy.identity(user),policy.email(user)))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the project owner can manage colleague access.");
    }
    @GetMapping public List<Map<String,Object>> list(@AuthenticationPrincipal OidcUser user) throws Exception {owner(user);return access.members();}
    @PostMapping public List<Map<String,Object>> grant(@AuthenticationPrincipal OidcUser user,@Valid @RequestBody Colleague colleague) throws Exception {
        owner(user);access.change(policy.identity(user),colleague.email(),true);return access.members();
    }
    @PostMapping("/revoke") public List<Map<String,Object>> revoke(@AuthenticationPrincipal OidcUser user,@Valid @RequestBody Colleague colleague) throws Exception {
        owner(user);access.change(policy.identity(user),colleague.email(),false);return access.members();
    }
}
