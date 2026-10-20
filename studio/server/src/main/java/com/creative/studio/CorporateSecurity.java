package com.creative.studio;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.*;
import org.springframework.security.oauth2.client.endpoint.*;
import org.springframework.security.oauth2.client.oidc.authentication.OidcIdTokenValidator;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.core.http.converter.OAuth2AccessTokenResponseHttpMessageConverter;
import org.springframework.http.converter.FormHttpMessageConverter;
import org.springframework.security.web.*;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.net.*;
import java.time.Duration;
import java.util.*;

@Configuration
@Profile("corporate")
public class CorporateSecurity {
    @Bean ClientRegistrationRepository corporateClient(CorporatePolicy policy,
            @Value("${creative.corporate.client-id}") String id,@Value("${creative.corporate.client-secret}") String secret) {
        if(id.isBlank()||secret.isBlank())throw new IllegalStateException("Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the hosting secret manager.");
        return new InMemoryClientRegistrationRepository(ClientRegistration.withRegistrationId("corporate")
            .clientId(id).clientSecret(secret).clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE).redirectUri(policy.publicUrl()+"/login/oauth2/code/corporate")
            .scope("openid","email").authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
            .tokenUri("https://oauth2.googleapis.com/token").jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
            .issuerUri("https://accounts.google.com").userNameAttributeName("sub").clientName("Corporate Google account").build());
    }
    static SimpleClientHttpRequestFactory networkFactory() {
        var factory=new SimpleClientHttpRequestFactory(){
            @Override protected HttpURLConnection openConnection(URL url,Proxy proxy) throws IOException {
                return super.openConnection(url,Set.of("localhost","127.0.0.1","::1").contains(url.getHost())?Proxy.NO_PROXY:proxy);
            }
        };factory.setConnectTimeout(Duration.ofSeconds(15));factory.setReadTimeout(Duration.ofSeconds(30));
        var configured=System.getenv("HTTPS_PROXY");
        if(configured!=null&&!configured.isBlank()) {
            var uri=URI.create(configured);factory.setProxy(new Proxy(Proxy.Type.HTTP,new InetSocketAddress(uri.getHost(),uri.getPort()>0?uri.getPort():80)));
        }
        return factory;
    }
    @Bean SecurityFilterChain privateFilterChain(HttpSecurity http,CorporatePolicy policy) throws Exception {
        var tokenClient=new DefaultAuthorizationCodeTokenResponseClient();
        var tokenRest=new RestTemplate(List.of(new FormHttpMessageConverter(),new OAuth2AccessTokenResponseHttpMessageConverter()));
        tokenRest.setRequestFactory(networkFactory());tokenRest.setErrorHandler(new org.springframework.security.oauth2.client.http.OAuth2ErrorResponseErrorHandler());tokenClient.setRestOperations(tokenRest);
        var users=new OidcUserService();users.setRetrieveUserInfo(request->false);
        http.authorizeHttpRequests(r->r.requestMatchers("/signin.html","/signin.css","/logo.svg","/favicon.svg","/healthz","/oauth2/**","/login/oauth2/**").permitAll().anyRequest().authenticated())
            .exceptionHandling(e->e.authenticationEntryPoint((req,res,error)->{
                if(req.getRequestURI().startsWith("/api/")){res.setStatus(401);res.setContentType("application/json");res.getWriter().write("{\"message\":\"Sign in with your approved corporate account.\"}");}
                else res.sendRedirect("/signin.html");
            }).accessDeniedHandler((req,res,error)->{res.setStatus(403);res.setContentType("application/json");res.getWriter().write("{\"message\":\"Write permission or session verification failed. Reload Studio and sign in again.\"}");}))
            .oauth2Login(o->o.loginPage("/signin.html").tokenEndpoint(t->t.accessTokenResponseClient(tokenClient))
                .userInfoEndpoint(u->u.oidcUserService(request->{var user=users.loadUser(request);policy.email(user);return user;}))
                .successHandler((req,res,authentication)->{req.getSession().setAttribute("studio:authenticatedAt",System.currentTimeMillis());res.sendRedirect("/");}).failureUrl("/signin.html?denied=1"))
            .logout(l->l.logoutUrl("/api/logout").logoutSuccessHandler((req,res,auth)->res.setStatus(204)).invalidateHttpSession(true).clearAuthentication(true).deleteCookies("JSESSIONID"));
        http.addFilterBefore(new OncePerRequestFilter(){
            @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
                var auth=SecurityContextHolder.getContext().getAuthentication();
                if(auth!=null&&auth.isAuthenticated()&&!(auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)) {
                    try {
                        if(!(auth.getPrincipal() instanceof org.springframework.security.oauth2.core.oidc.user.OidcUser))throw new OAuth2AuthenticationException("Corporate OIDC sign-in is required");
                        var user=(org.springframework.security.oauth2.core.oidc.user.OidcUser)auth.getPrincipal();
                        policy.email(user);
                        var session=req.getSession(false);
                        if(user.getIdToken().getExpiresAt()==null||user.getIdToken().getExpiresAt().isBefore(java.time.Instant.now()))throw new OAuth2AuthenticationException("Corporate sign-in expired");
                        if(session!=null) {
                            var authenticated=session.getAttribute("studio:authenticatedAt");
                            if(authenticated==null)session.setAttribute("studio:authenticatedAt",System.currentTimeMillis());
                            else if(!(authenticated instanceof Long)||System.currentTimeMillis()-(Long)authenticated>Duration.ofHours(8).toMillis())throw new OAuth2AuthenticationException("Session expired");
                        }
                    }catch(OAuth2AuthenticationException error){
                        SecurityContextHolder.clearContext();var session=req.getSession(false);if(session!=null)session.invalidate();
                        res.setStatus(403);res.setContentType("application/json");res.getWriter().write("{\"message\":\"Corporate access is not available. Contact the project owner.\"}");return;
                    }
                }
                chain.doFilter(req,res);
            }
        },AuthorizationFilter.class);
        return http.build();
    }
    @Bean JwtDecoderFactory<ClientRegistration> idTokenDecoders() {
        return registration->{
            var rest=new RestTemplate();rest.setRequestFactory(networkFactory());
            var decoder=NimbusJwtDecoder.withJwkSetUri(registration.getProviderDetails().getJwkSetUri()).restOperations(rest).build();
            decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(new JwtTimestampValidator(),new OidcIdTokenValidator(registration)));
            return decoder;
        };
    }
}
