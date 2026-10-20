package com.creative.studio;

import org.springframework.context.annotation.Profile;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
@Profile("corporate")
public class CorporatePolicy {
    private final String domain,publicUrl;
    private final AccessDirectory access;
    public CorporatePolicy(CorporateDeployment deployment,AccessDirectory access) {
        this.access=access;
        this.domain=deployment.domain();
        this.publicUrl=deployment.publicUrl();
    }
    public String publicUrl(){return publicUrl;}
    public String email(OidcUser user) {
        var email=Objects.requireNonNullElse(user.getEmail(),"").toLowerCase(Locale.ROOT);
        if(user.getIssuer()==null||!"https://accounts.google.com".equals(user.getIssuer().toString())||user.getSubject()==null||user.getSubject().isBlank()
                ||!Boolean.TRUE.equals(user.getEmailVerified())||!domain.equals(user.getClaimAsString("hd")))
            throw new OAuth2AuthenticationException(new OAuth2Error("access_denied"),"This corporate account is not approved for Studio.");
        try{if(!access.authorize(user.getIssuer()+"|"+user.getSubject(),email))throw new OAuth2AuthenticationException("Corporate access is not approved");}
        catch(java.io.IOException|java.security.GeneralSecurityException error){throw new OAuth2AuthenticationException("Private access directory is unavailable");}
        return email;
    }
    public String identity(OidcUser user){email(user);return user.getIssuer()+"|"+user.getSubject();}
    public boolean canManage(OidcUser user){try{return access.owner(identity(user),email(user));}catch(Exception error){return false;}}
}
