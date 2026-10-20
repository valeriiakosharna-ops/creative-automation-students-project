package com.creative.studio;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.beans.factory.annotation.Value;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.*;
import static com.creative.studio.CopyModels.*;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final OpenAiCopyService copy;
    private final boolean clientKeysEnabled;
    @org.springframework.beans.factory.annotation.Autowired(required=false) private EncryptedWorkspace workspace;
    @org.springframework.beans.factory.annotation.Autowired(required=false) private CorporatePolicy corporate;
    public ApiController(OpenAiCopyService copy,@Value("${creative.openai.client-keys-enabled:false}") boolean clientKeysEnabled) { this.copy=copy;this.clientKeysEnabled=clientKeysEnabled; }
    @GetMapping("/health") public Map<String,Object> health() {
        return Map.of("service","creative-automation-studio","aiConfigured",!clientKeysEnabled&&copy.configured(),"clientKeysEnabled",clientKeysEnabled,"styleGuideVersion",copy.policyVersion());
    }
    @PostMapping("/copy") public CopyResponse generate(@Valid @RequestBody CopyRequest request,
            @RequestHeader(value="X-OpenAI-Key",required=false) String clientKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.core.oidc.user.OidcUser user) throws Exception {
        validatePlan(request);
        if(request.styleGuideVersion()!=null && !request.styleGuideVersion().equals(copy.policyVersion()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Browser and server style guide versions differ. Rebuild/restart the server and reload Studio.");
        if(clientKeysEnabled) {
            if(clientKey==null||clientKey.isBlank())throw new ResponseStatusException(HttpStatus.PRECONDITION_REQUIRED,"Connect your OpenAI key in Studio for this visit, or choose Template mode.");
            if(clientKey.length()>512||clientKey.chars().anyMatch(c->c<=32||c>=127))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The API key contains unexpected characters. Paste the key without spaces or quotes.");
            return copy.generate(request,clientKey);
        }
        if(workspace!=null&&copy.configured())workspace.consumeAttempt(corporate.identity(user));
        return copy.generate(request);
    }
    static void validatePlan(CopyRequest request) {
        var b=request.brief();
        try {LocalDate.parse(b.date());ZoneId.of(b.timeZone());if(b.time()!=null&&!b.time().isBlank())LocalTime.parse(b.time());}
        catch(Exception e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use a valid date, time and IANA time zone.");}
        if(b.formats().stream().distinct().count()!=b.formats().size()||b.languages().stream().distinct().count()!=b.languages().size())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Formats and languages must be unique.");
        var expected=new HashSet<String>();
        for(var format:b.formats())for(var language:b.languages())for(int variant=1;variant<=b.variants();variant++)expected.add(format+"-"+language+"-"+variant);
        var actual=new HashSet<String>();
        for(var o:request.outputs()) {
            if(!o.id().equals(o.format()+"-"+o.language()+"-"+o.variant())||!actual.add(o.id()))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Output identities must be unique and match their specifications.");
        }
        if(!actual.equals(expected))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Outputs must match the selected formats, languages and variants.");
    }
}

@RestControllerAdvice
class ApiErrors {
    @ExceptionHandler(ResponseStatusException.class)
    org.springframework.http.ResponseEntity<Map<String,String>> status(ResponseStatusException error) {
        return org.springframework.http.ResponseEntity.status(error.getStatusCode()).body(Map.of("message",Objects.requireNonNullElse(error.getReason(),"Request failed.")));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class})
    org.springframework.http.ResponseEntity<Map<String,String>> validation(Exception error) {
        return org.springframework.http.ResponseEntity.badRequest().body(Map.of("message","Invalid brief. Check required fields, supported languages/formats, and the 24-output limit."));
    }
}
