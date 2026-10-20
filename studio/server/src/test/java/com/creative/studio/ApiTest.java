package com.creative.studio;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.*;

@SpringBootTest(properties="creative.openai.api-key=")
@AutoConfigureMockMvc
class ApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    static Map<String,Object> request() {
        var brief=new LinkedHashMap<String,Object>();
        brief.put("title","ML Week");brief.put("description","A student workshop");brief.put("date","2026-11-21");brief.put("timeZone","Europe/Kyiv");brief.put("sourceLanguage","en");
        brief.put("formats",List.of("facebook"));brief.put("languages",List.of("uk"));brief.put("variants",1);brief.put("colors",List.of("#00a6eb","#e60036","#302a40"));
        return new LinkedHashMap<>(Map.of("brief",brief,"outputs",List.of(Map.of("id","facebook-uk-1","format","facebook","language","uk","variant",1))));
    }
    @Test void healthDoesNotExposeSecrets() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.aiConfigured").value(false)).andExpect(jsonPath("$.apiKey").doesNotExist());
    }
    @Test void blankKeyHasAnActionableError() throws Exception {
        mvc.perform(post("/api/copy").contentType("application/json").content(mapper.writeValueAsBytes(request())))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("CREATIVE_OPENAI_API_KEY")));
    }
    @Test @SuppressWarnings("unchecked") void languageIsRequired() throws Exception {
        var data=request();((Map<String,Object>)data.get("brief")).put("languages",List.of());
        mvc.perform(post("/api/copy").contentType("application/json").content(mapper.writeValueAsBytes(data))).andExpect(status().isBadRequest());
    }
    @Test void outputCannotDisagreeWithBrief() throws Exception {
        var data=request();data.put("outputs",List.of(Map.of("id","facebook-en-1","format","facebook","language","en","variant",1)));
        mvc.perform(post("/api/copy").contentType("application/json").content(mapper.writeValueAsBytes(data))).andExpect(status().isBadRequest());
    }
    @Test @SuppressWarnings("unchecked") void impossibleCalendarDateIsRejected() throws Exception {
        var data=request();((Map<String,Object>)data.get("brief")).put("date","2026-02-30");
        mvc.perform(post("/api/copy").contentType("application/json").content(mapper.writeValueAsBytes(data))).andExpect(status().isBadRequest());
    }
    @Test void mismatchedStyleGuideIsRejectedBeforeSpendingCredits() throws Exception {
        var data=request();data.put("styleGuideVersion","old-guide");
        mvc.perform(post("/api/copy").contentType("application/json").content(mapper.writeValueAsBytes(data))).andExpect(status().isConflict());
    }
    @Test void oversizedJsonIsRejectedBeforeParsing() throws Exception {
        mvc.perform(post("/api/copy").contentType("application/json").content(" ".repeat(65537))).andExpect(status().isPayloadTooLarge());
    }
    @Test void onlyConfiguredOriginsReceiveCorsPermission() throws Exception {
        mvc.perform(options("/api/copy").header("Origin","https://untrusted.invalid").header("Access-Control-Request-Method","POST")).andExpect(status().isForbidden());
        mvc.perform(options("/api/copy").header("Origin","http://localhost:5173").header("Access-Control-Request-Method","POST")).andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://localhost:5173"));
    }
}
