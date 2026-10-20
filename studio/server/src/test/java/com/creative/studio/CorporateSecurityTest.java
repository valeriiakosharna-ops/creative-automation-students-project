package com.creative.studio;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.*;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.core.oidc.*;
import org.springframework.security.oauth2.core.oidc.user.*;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.web.util.UriComponentsBuilder;
import java.io.*;
import java.net.InetSocketAddress;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"creative.corporate.owner-email=owner@team.example",
    "creative.corporate.render-public-url=https://studio.team.example","creative.corporate.client-id=test-google-client",
    "creative.corporate.client-secret=test-only-not-a-real-secret","creative.workspace.key=test-only-private-storage-key-never-use-for-production",
    "creative.openai.api-key="})
@ActiveProfiles("corporate")
@AutoConfigureMockMvc
@Import(CorporateSecurityTest.ProviderConfiguration.class)
class CorporateSecurityTest {
    static final ObjectMapper JSON=new ObjectMapper();
    static final RSAKey KEY=key();
    static final AtomicReference<String> nonce=new AtomicReference<>("");
    static final AtomicReference<String> tokenMode=new AtomicReference<>("valid");
    static final HttpServer PROVIDER=provider();
    static final Path DATA=temp();
    static RSAKey key(){try{return new RSAKeyGenerator(2048).keyID("test-key").generate();}catch(Exception e){throw new IllegalStateException(e);}}
    static Path temp(){try{return Files.createTempDirectory("studio-corporate-test-");}catch(IOException e){throw new IllegalStateException(e);}}
    static HttpServer provider(){
        try{
            var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
            server.createContext("/keys",exchange->{var body=new JWKSet(KEY.toPublicJWK()).toString().getBytes();exchange.getResponseHeaders().add("Content-Type","application/json");exchange.sendResponseHeaders(200,body.length);exchange.getResponseBody().write(body);exchange.close();});
            server.createContext("/token",exchange->{
                try{
                    var now=Instant.now();var claims=new JWTClaimsSet.Builder().issuer("https://accounts.google.com").subject("owner-sub").audience(tokenMode.get().equals("wrong-audience")?"another-client":"test-google-client")
                        .issueTime(Date.from(now.minusSeconds(5))).expirationTime(Date.from(now.plusSeconds(300))).claim("nonce",tokenMode.get().equals("wrong-nonce")?"incorrect-nonce":nonce.get()).claim("email","owner@team.example").claim("email_verified",true).claim("hd","team.example").build();
                    var jwt=new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(KEY.getKeyID()).build(),claims);jwt.sign(new RSASSASigner(tokenMode.get().equals("wrong-signature")?new RSAKeyGenerator(2048).generate():KEY));
                    byte[] body=JSON.writeValueAsBytes(Map.of("access_token","fake-access-token","token_type","Bearer","expires_in",300,"id_token",jwt.serialize()));
                    exchange.getResponseHeaders().add("Content-Type","application/json");exchange.sendResponseHeaders(200,body.length);exchange.getResponseBody().write(body);
                }catch(Exception e){exchange.sendResponseHeaders(500,-1);}finally{exchange.close();}
            });server.start();return server;
        }catch(IOException e){throw new IllegalStateException(e);}
    }
    @TestConfiguration static class ProviderConfiguration {
        @Bean @Primary ClientRegistrationRepository testRegistration(){
            String base="http://127.0.0.1:"+PROVIDER.getAddress().getPort();
            return new InMemoryClientRegistrationRepository(ClientRegistration.withRegistrationId("corporate").clientId("test-google-client").clientSecret("not-real")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE).clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .redirectUri("https://studio.team.example/login/oauth2/code/corporate").scope("openid","email").authorizationUri(base+"/authorize").tokenUri(base+"/token").jwkSetUri(base+"/keys")
                .issuerUri("https://accounts.google.com").userNameAttributeName("sub").clientName("Test corporate").build());
        }
    }
    @DynamicPropertySource static void data(DynamicPropertyRegistry registry){registry.add("creative.workspace.directory",DATA::toString);}
    @AfterAll static void close() throws IOException{PROVIDER.stop(0);EncryptedWorkspace.removeTree(DATA);}
    @Autowired MockMvc mvc;
    @Autowired AccessDirectory access;
    @Autowired CorporatePolicy policy;
    static OidcUser identity(String sub,String email,boolean verified,String domain){
        var token=OidcIdToken.withTokenValue("test-id-token-not-used-in-production").issuer("https://accounts.google.com").subject(sub).issuedAt(Instant.now().minusSeconds(5)).expiresAt(Instant.now().plusSeconds(300)).claim("email",email).claim("email_verified",verified).claim("hd",domain).build();
        return new DefaultOidcUser(List.of(new SimpleGrantedAuthority("OIDC_USER")),token);
    }
    static OidcUser owner(){return identity("owner-sub","owner@team.example",true,"team.example");}
    static OidcUser member(){return identity("member-sub","member@team.example",true,"team.example");}
    void invite() throws Exception{access.change(policy.identity(owner()),"member@team.example",true);}
    @Test void anonymousUsersCannotReadPagesRuntimeFilesMaterialsOrTheAccessList() throws Exception {
        mvc.perform(get("/")).andExpect(status().is3xxRedirection()).andExpect(redirectedUrl("/signin.html"));
        for(var path:List.of("/runtime.js","/brand-policy.json","/style-guide/index.html"))mvc.perform(get(path)).andExpect(status().is3xxRedirection());
        for(var path:List.of("/api/session","/api/health","/api/workspace/projects","/api/access","/api/workspace/projects/"+UUID.randomUUID()+"/blobs/"+UUID.randomUUID()))
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get("/healthz")).andExpect(status().isOk()).andExpect(content().json("{\"status\":\"UP\"}"));
    }
    @Test void personalUnverifiedWrongDomainAndUninvitedCorporateAccountsAreRejected() throws Exception {
        mvc.perform(get("/api/workspace/projects").with(user("non-oidc-account"))).andExpect(status().isForbidden());
        for(var user:List.of(identity("outsider","outsider@gmail.com",true,"gmail.com"),identity("owner-sub","owner@team.example",false,"team.example"),identity("other","other@team.example",true,"wrong.example"),identity("stranger","stranger@team.example",true,"team.example")))
            mvc.perform(get("/api/workspace/projects").with(oidcLogin().oidcUser(user))).andExpect(status().isForbidden());
    }
    @Test void ownerCanAddAndRevokeColleaguesAndRevokedSessionsLoseFileAccess() throws Exception {
        mvc.perform(post("/api/access").with(oidcLogin().oidcUser(owner())).with(csrf()).contentType("application/json").content("{\"email\":\"member@team.example\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.email == 'member@team.example')].active").value(org.hamcrest.Matchers.hasItem(true)));
        mvc.perform(get("/api/workspace/projects").with(oidcLogin().oidcUser(member()))).andExpect(status().isOk());
        mvc.perform(get("/api/access").with(oidcLogin().oidcUser(member()))).andExpect(status().isForbidden());
        mvc.perform(post("/api/access/revoke").with(oidcLogin().oidcUser(owner())).with(csrf()).contentType("application/json").content("{\"email\":\"member@team.example\"}"))
            .andExpect(status().isOk());
        mvc.perform(get("/api/workspace/projects").with(oidcLogin().oidcUser(member()))).andExpect(status().isForbidden());
        mvc.perform(get("/api/workspace/projects/"+UUID.randomUUID()+"/blobs/"+UUID.randomUUID()).with(oidcLogin().oidcUser(member()))).andExpect(status().isForbidden());
    }
    @Test void expiredGoogleTokensAndOverAgeSessionsAreRejected() throws Exception {
        var token=OidcIdToken.withTokenValue("expired-test-token").issuer("https://accounts.google.com").subject("owner-sub")
            .issuedAt(Instant.now().minusSeconds(600)).expiresAt(Instant.now().minusSeconds(60)).claim("email","owner@team.example").claim("email_verified",true).claim("hd","team.example").build();
        var expired=new DefaultOidcUser(List.of(new SimpleGrantedAuthority("OIDC_USER")),token);
        mvc.perform(get("/api/session").with(oidcLogin().oidcUser(expired))).andExpect(status().isForbidden());
        var session=new MockHttpSession();session.setAttribute("studio:authenticatedAt",System.currentTimeMillis()-java.time.Duration.ofHours(9).toMillis());
        mvc.perform(get("/api/session").session(session).with(oidcLogin().oidcUser(owner()))).andExpect(status().isForbidden());
        assertTrue(session.isInvalid());
    }
    @Test void membershipChangesRequireOwnerAndCsrfAndCannotRemoveOwner() throws Exception {
        invite();String body="{\"email\":\"another@team.example\"}";
        mvc.perform(post("/api/access").with(oidcLogin().oidcUser(owner())).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/access").with(oidcLogin().oidcUser(member())).with(csrf()).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/access/revoke").with(oidcLogin().oidcUser(owner())).with(csrf()).contentType("application/json").content("{\"email\":\"owner@team.example\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/access").with(oidcLogin().oidcUser(owner())).with(csrf()).contentType("application/json").content("{\"email\":\"personal@gmail.com\"}")).andExpect(status().isBadRequest());
    }
    @Test void approvedColleaguesShareEncryptedMaterialsAndStaleWritesCannotClobberThem() throws Exception {
        invite();String id=UUID.randomUUID().toString(),blob=UUID.randomUUID().toString();
        var record=Map.of("id",id,"name","Private team event","image",Map.of("__studioBlob",blob,"type","image/png","size",EncryptedWorkspaceTest.PNG.length));
        var upload=EncryptedWorkspaceTest.upload(JSON,record,Map.of(blob,EncryptedWorkspaceTest.PNG));
        mvc.perform(post("/api/workspace/projects/"+id).with(oidcLogin().oidcUser(owner())).with(csrf()).header("If-Match","0").contentType("application/zip").content(upload)).andExpect(status().isOk());
        mvc.perform(get("/api/workspace/projects/"+id).with(oidcLogin().oidcUser(member()))).andExpect(status().isOk()).andExpect(jsonPath("$.record.name").value("Private team event"));
        mvc.perform(get("/api/workspace/projects/"+id+"/blobs/"+blob).with(oidcLogin().oidcUser(member()))).andExpect(status().isOk()).andExpect(content().bytes(EncryptedWorkspaceTest.PNG)).andExpect(header().string("Cache-Control","no-store"));
        mvc.perform(post("/api/workspace/projects/"+id).with(oidcLogin().oidcUser(member())).with(csrf()).header("If-Match","0").contentType("application/zip").content(upload)).andExpect(status().isConflict());
        mvc.perform(delete("/api/workspace/projects/"+id).with(oidcLogin().oidcUser(member())).header("If-Match","1")).andExpect(status().isForbidden());
    }
    @Test void runtimeAndSessionContainNoKeyOrOtherMembersAddresses() throws Exception {
        mvc.perform(get("/runtime.js").with(oidcLogin().oidcUser(owner()))).andExpect(status().isOk())
            .andExpect(content().string(org.hamcrest.Matchers.containsString("\"corporate\":true")))
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("@team.example"))));
        mvc.perform(get("/api/session").with(oidcLogin().oidcUser(owner()))).andExpect(jsonPath("$.canManageAccess").value(true)).andExpect(jsonPath("$.apiKey").doesNotExist());
        invite();mvc.perform(get("/api/session").with(oidcLogin().oidcUser(member()))).andExpect(jsonPath("$.canManageAccess").value(false)).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("owner@team.example"))));
    }
    @Test void copyAndLogoutRequireCsrfEvenForApprovedAccounts() throws Exception {
        mvc.perform(post("/api/copy").with(oidcLogin().oidcUser(owner())).contentType("application/json").content(JSON.writeValueAsBytes(ApiTest.request()))).andExpect(status().isForbidden());
        mvc.perform(post("/api/logout").with(oidcLogin().oidcUser(owner()))).andExpect(status().isForbidden());
        mvc.perform(post("/api/logout").with(oidcLogin().oidcUser(owner())).with(csrf())).andExpect(status().isNoContent());
    }
    @Test void actualAuthorizationCodeRoundTripVerifiesSignatureNonceAndAudience() throws Exception {
        tokenMode.set("valid");var start=mvc.perform(get("/oauth2/authorization/corporate")).andExpect(status().is3xxRedirection()).andReturn();
        var query=UriComponentsBuilder.fromUriString(start.getResponse().getRedirectedUrl()).build().getQueryParams();nonce.set(java.net.URLDecoder.decode(query.getFirst("nonce"),java.nio.charset.StandardCharsets.UTF_8));
        var session=(MockHttpSession)start.getRequest().getSession(false);
        mvc.perform(get("/login/oauth2/code/corporate").param("code","test-code").param("state",java.net.URLDecoder.decode(query.getFirst("state"),java.nio.charset.StandardCharsets.UTF_8)).session(session)).andExpect(status().is3xxRedirection()).andExpect(redirectedUrl("/"));
        var account=mvc.perform(get("/api/session").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.canManageAccess").value(true)).andReturn();
        var csrfToken=JSON.readTree(account.getResponse().getContentAsString()).path("csrfToken").asText();
        // Use the real browser-facing token/header, without the test csrf() shortcut.
        mvc.perform(post("/api/access").session(session).header("X-CSRF-TOKEN",csrfToken).contentType("application/json").content("{\"email\":\"roundtrip@team.example\"}")).andExpect(status().isOk());
        mvc.perform(post("/api/logout").session(session).header("X-CSRF-TOKEN",csrfToken)).andExpect(status().isNoContent());
        mvc.perform(get("/api/session").session(session)).andExpect(status().isUnauthorized());
        for (var mode:List.of("wrong-audience","wrong-nonce","wrong-signature")) {
            tokenMode.set(mode);start=mvc.perform(get("/oauth2/authorization/corporate")).andReturn();query=UriComponentsBuilder.fromUriString(start.getResponse().getRedirectedUrl()).build().getQueryParams();nonce.set(java.net.URLDecoder.decode(query.getFirst("nonce"),java.nio.charset.StandardCharsets.UTF_8));
            mvc.perform(get("/login/oauth2/code/corporate").param("code","test-code").param("state",java.net.URLDecoder.decode(query.getFirst("state"),java.nio.charset.StandardCharsets.UTF_8)).session((MockHttpSession)start.getRequest().getSession(false))).andExpect(redirectedUrl("/signin.html?denied=1"));
        }
        tokenMode.set("valid");
    }
}
