package com.creative.studio;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="creative.openai.api-key=owner-key-must-not-be-used")
@ActiveProfiles("hosted")
@AutoConfigureMockMvc
class HostedApiTest {
    static final AtomicInteger calls=new AtomicInteger();
    static final AtomicReference<String> authorization=new AtomicReference<>(),body=new AtomicReference<>();
    static final HttpServer provider=startProvider();
    static HttpServer startProvider() {
        try {
            var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
            server.createContext("/chat/completions",exchange->{
                calls.incrementAndGet();authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
                body.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
                var mapper=new ObjectMapper();
                var content=mapper.writeValueAsString(Map.of("outputs",List.of(Map.of("id","facebook-uk-1","headline","Зустріч студентів","subheading","","cta","Долучайтеся","caption","Вітаємо на події!"))));
                var response=mapper.writeValueAsBytes(Map.of("choices",List.of(Map.of("finish_reason","stop","message",Map.of("content",content)))));
                exchange.getResponseHeaders().add("Content-Type","application/json");exchange.sendResponseHeaders(200,response.length);exchange.getResponseBody().write(response);exchange.close();
            });server.start();return server;
        }catch(Exception error){throw new IllegalStateException(error);}
    }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("creative.openai.base-url",()->"http://127.0.0.1:"+provider.getAddress().getPort());
    }
    @AfterAll static void stopProvider(){provider.stop(0);}
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Test void aHostedRequestAlwaysRequiresItsOwnKeyEvenWhenAnOwnerKeyExists() throws Exception {
        int before=calls.get();
        mvc.perform(post("/api/copy").contentType("application/json").content(mapper.writeValueAsBytes(ApiTest.request())))
            .andExpect(status().isPreconditionRequired()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("this visit")));
        assertEquals(before,calls.get());
    }
    @Test void suppliedKeyIsOnlyForwardedInTheProviderHeaderAndNeverEchoed() throws Exception {
        String testKey="visitor-test-key-not-a-real-secret";
        var response=mvc.perform(post("/api/copy").header("X-OpenAI-Key",testKey).contentType("application/json").content(mapper.writeValueAsBytes(ApiTest.request())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.styleGuideVersion").value("1.0.0")).andReturn().getResponse().getContentAsString();
        assertEquals("Bearer "+testKey,authorization.get());
        assertFalse(body.get().contains(testKey));assertFalse(response.contains(testKey));
        assertFalse(body.get().contains("owner-key-must-not-be-used"));
        int before=calls.get();
        mvc.perform(post("/api/copy").contentType("application/json").content(mapper.writeValueAsBytes(ApiTest.request()))).andExpect(status().isPreconditionRequired());
        assertEquals(before,calls.get());
    }
    @Test void invalidKeyInputFailsWithoutAProviderRequestOrSecretEcho() throws Exception {
        int before=calls.get();
        mvc.perform(post("/api/copy").header("X-OpenAI-Key","invalid key value").contentType("application/json").content(mapper.writeValueAsBytes(ApiTest.request())))
            .andExpect(status().isBadRequest()).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("invalid key value"))));
        assertEquals(before,calls.get());
    }
    @Test void publicRuntimeUsesNoSecretsAndKeepsTheAppOnItsOwnServer() throws Exception {
        mvc.perform(get("/runtime.js")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("\"clientKeysEnabled\":true")))
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("owner-key"))));
        mvc.perform(get("/api/health")).andExpect(jsonPath("$.aiConfigured").value(false)).andExpect(jsonPath("$.clientKeysEnabled").value(true));
    }
    @Test void hostedResponsesConstrainScriptsAndCrossOriginRequests() throws Exception {
        mvc.perform(get("/api/health")).andExpect(header().string("Content-Security-Policy",org.hamcrest.Matchers.containsString("connect-src 'self'")))
            .andExpect(header().string("Referrer-Policy","no-referrer"));
        mvc.perform(options("/api/copy").header("Origin","https://untrusted.invalid").header("Access-Control-Request-Method","POST").header("Access-Control-Request-Headers","X-OpenAI-Key"))
            .andExpect(status().isForbidden());
    }
}
