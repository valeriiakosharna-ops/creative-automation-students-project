package com.creative.studio;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
public class RuntimeController {
    private final OpenAiCopyService copy;
    private final boolean clientKeysEnabled;
    private final ObjectMapper mapper;
    private final boolean corporate;
    public RuntimeController(OpenAiCopyService copy, ObjectMapper mapper,
            @Value("${creative.openai.client-keys-enabled:false}") boolean clientKeysEnabled,
            @Value("${creative.corporate.enabled:false}") boolean corporate) {
        this.copy=copy;this.mapper=mapper;this.clientKeysEnabled=clientKeysEnabled;this.corporate=corporate;
    }
    @GetMapping(value="/runtime.js",produces="application/javascript")
    public ResponseEntity<String> runtime() throws JsonProcessingException {
        var settings=Map.of("serverManaged",true,"clientKeysEnabled",clientKeysEnabled,
            "aiConfigured",!clientKeysEnabled&&copy.configured(),"corporate",corporate,"workspaceStorage",corporate?"server":"browser");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body("window.STUDIO_RUNTIME = "+mapper.writeValueAsString(settings)+";\n");
    }
    @GetMapping("/healthz") public Map<String,String> liveness(){return Map.of("status","UP");}
}
