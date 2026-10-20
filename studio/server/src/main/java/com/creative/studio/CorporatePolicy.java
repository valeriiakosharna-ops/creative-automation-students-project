package com.creative.studio;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.util.*;

@Component
@Profile("corporate")
public class CorporatePolicy {
    private final String domain,publicUrl;
    private final AccessDirectory access;
    public CorporatePolicy(@Value("${creative.corporate.domain}") String domain,
            @Value("${creative.corporate.public-url}") String publicUrl,AccessDirectory access) {
        this.access=access;
        this.domain=domain.trim().toLowerCase(Locale.ROOT);
        if(!this.domain.matches("[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\\.[a-z]{2,}"))throw new IllegalStateException("Set STUDIO_EMAIL_DOMAIN to your Google Workspace domain.");
        var uri=URI.create(publicUrl);
        if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null||!(uri.getPath().isEmpty()||uri.getPath().equals("/")))throw new IllegalStateException("STUDIO_PUBLIC_URL must be the full HTTPS site origin, with no path or credentials.");
        this.publicUrl=publicUrl.replaceAll("/+$","");
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
