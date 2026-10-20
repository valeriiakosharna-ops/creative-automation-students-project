package com.creative.studio;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.util.Locale;

/** Resolve private deployment settings once; never derive OAuth URLs from requests. */
@Component
@Profile("corporate")
public class CorporateDeployment {
    private final String domain,owner,publicUrl;
    public CorporateDeployment(@Value("${creative.corporate.domain:}") String configuredDomain,
            @Value("${creative.corporate.owner-email:}") String owner,
            @Value("${creative.corporate.public-url:}") String configuredUrl,
            @Value("${creative.corporate.render-public-url:}") String renderUrl) {
        this.owner=owner.trim().toLowerCase(Locale.ROOT);
        if(this.owner.length()>254||!this.owner.matches("[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[^@\\s]+"))
            throw new IllegalStateException("Set STUDIO_OWNER_EMAIL to the owner's exact primary Google Workspace address in the hosting settings.");
        String ownerDomain=this.owner.substring(this.owner.indexOf('@')+1);
        this.domain=configuredDomain.isBlank()?ownerDomain:configuredDomain.trim().toLowerCase(Locale.ROOT);
        if(!this.domain.matches("[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+")||!this.domain.equals(ownerDomain))
            throw new IllegalStateException("Use the owner's corporate domain. An optional STUDIO_EMAIL_DOMAIN override must match STUDIO_OWNER_EMAIL.");
        String origin=(configuredUrl.isBlank()?renderUrl:configuredUrl).trim();
        try {
            var uri=URI.create(origin);
            if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null
                    ||!(uri.getPath().isEmpty()||uri.getPath().equals("/"))||uri.getPort()==0||uri.getPort()>65535)
                throw new IllegalArgumentException();
        }catch(IllegalArgumentException error){
            throw new IllegalStateException("An HTTPS site origin is required. Render supplies RENDER_EXTERNAL_URL automatically; on other hosts set STUDIO_PUBLIC_URL without a path or credentials.");
        }
        this.publicUrl=origin.replaceAll("/+$","");
    }
    public String domain(){return domain;}
    public String owner(){return owner;}
    public String publicUrl(){return publicUrl;}
}
