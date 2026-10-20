package com.creative.studio;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CorporateDeploymentTest {
    @Test void derivesOneExactDomainAndTheRenderOriginFromPrivateSettings() {
        var settings=new CorporateDeployment(""," Owner@Team.Example ",""," https://studio.example.org/ ");
        assertEquals("owner@team.example",settings.owner());assertEquals("team.example",settings.domain());
        assertEquals("https://studio.example.org",settings.publicUrl());
    }
    @Test void explicitOriginSupportsCustomDomainsAndNonRenderHosts() {
        var settings=new CorporateDeployment("TEAM.EXAMPLE","owner@team.example","https://custom.example.org/","https://render.example.org");
        assertEquals("https://custom.example.org",settings.publicUrl());
        assertEquals("https://internal.example.org",new CorporateDeployment("","owner@team.example","https://internal.example.org","").publicUrl());
    }
    @Test void invalidExplicitOriginFailsInsteadOfSilentlyFallingBackToRender() {
        for(var origin:new String[]{"http://example.org","https://example.org/path","https://example.org?key=hidden","https://user:secret@example.org","https://example.org#fragment","https://example.org:0","https://example.org:70000"}) {
            var error=assertThrows(IllegalStateException.class,()->new CorporateDeployment("","owner@team.example",origin,"https://render.example.org"));
            assertFalse(error.getMessage().contains(origin));
        }
    }
    @Test void missingOrInvalidRenderOriginsFailClosed() {
        for(var origin:new String[]{"","http://example.org","https://example.org/path","https://example.org?query=1"})
            assertThrows(IllegalStateException.class,()->new CorporateDeployment("","owner@team.example","",origin));
    }
    @Test void invalidOwnerOrBroaderDomainOverrideCannotChangeTheAccessBoundary() {
        for(var owner:new String[]{"","owner","owner@","owner@team.example@another.example","owner@team example"}) {
            assertThrows(IllegalStateException.class,()->new CorporateDeployment("",owner,"https://studio.example.org",""));
        }
        for(var domain:new String[]{"example","*.example","other.example"})
            assertThrows(IllegalStateException.class,()->new CorporateDeployment(domain,"owner@team.example","https://studio.example.org",""));
    }
}
