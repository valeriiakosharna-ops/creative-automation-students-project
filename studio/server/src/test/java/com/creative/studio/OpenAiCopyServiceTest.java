package com.creative.studio;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static com.creative.studio.CopyModels.*;

class OpenAiCopyServiceTest {
    final ObjectMapper mapper=new ObjectMapper();
    CopyRequest request() {return mapper.convertValue(ApiTest.request(),CopyRequest.class);}
    @Test void realHttpTransportSendsStructuredRequestAndValidatesResponse() throws Exception {
        var captured=new AtomicReference<String>();var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/v1/chat/completions",exchange->{
            captured.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
            var content=mapper.writeValueAsString(Map.of("outputs",List.of(Map.of("id","facebook-uk-1","headline","Тиждень ML","subheading","Подія для студентів","cta","Долучайтеся","caption","Долучайтеся до події!"))));
            var body=mapper.writeValueAsBytes(Map.of("choices",List.of(Map.of("finish_reason","stop","message",Map.of("content",content)))));
            exchange.getResponseHeaders().add("Content-Type","application/json");exchange.sendResponseHeaders(200,body.length);exchange.getResponseBody().write(body);exchange.close();
        });server.start();
        try {
            var service=new OpenAiCopyService(mapper,"test-only","test-model","http://127.0.0.1:"+server.getAddress().getPort()+"/v1");
            var response=service.generate(request());assertEquals("Тиждень ML",response.outputs().getFirst().headline());
            var sent=mapper.readTree(captured.get());assertEquals("json_schema",sent.path("response_format").path("type").asText());assertEquals("test-model",sent.path("model").asText());assertTrue(sent.path("messages").path(0).path("content").asText().contains("Mandatory brand style guide"));assertTrue(sent.path("messages").path(0).path("content").asText().contains("#00A6EB"));assertEquals("1.1.0",response.styleGuideVersion());
        }finally{server.stop(0);}
    }
    @Test void duplicateAndIncompleteOutputsAreRejected() throws Exception {
        assertThrows(IllegalArgumentException.class,()->OpenAiCopyService.validateResponse(mapper.readTree("{\"outputs\":[]}"),request(),OpenAiCopyService.readPolicy(mapper)));
        assertThrows(IllegalArgumentException.class,()->OpenAiCopyService.validateResponse(mapper.readTree("{\"outputs\":[{\"id\":\"wrong\",\"headline\":\"Title\",\"subheading\":\"\",\"cta\":\"Go\",\"caption\":\"Text\"}]}"),request(),OpenAiCopyService.readPolicy(mapper)));
    }
    @Test void formatSpecificStyleLimitsAreEnforced() throws Exception {
        var output=Map.of("id","facebook-uk-1","headline","Title","subheading","x".repeat(71),"cta","Join","caption","Valid caption");
        var content=mapper.valueToTree(Map.of("outputs",List.of(output)));
        assertThrows(IllegalArgumentException.class,()->OpenAiCopyService.validateResponse(content,request(),OpenAiCopyService.readPolicy(mapper)));
    }
    @Test void providerErrorsNeverEchoItsBody() throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/chat/completions",exchange->{var body="sensitive-provider-response".getBytes(StandardCharsets.UTF_8);exchange.sendResponseHeaders(401,body.length);exchange.getResponseBody().write(body);exchange.close();});server.start();
        try {var service=new OpenAiCopyService(mapper,"test-only","model","http://127.0.0.1:"+server.getAddress().getPort());var error=assertThrows(ResponseStatusException.class,()->service.generate(request()));assertFalse(error.getReason().contains("sensitive-provider-response"));assertEquals(502,error.getStatusCode().value());}finally{server.stop(0);}
    }
}
