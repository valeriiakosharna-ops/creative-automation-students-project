package com.creative.studio;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.util.Arrays;

@Configuration
public class WebConfiguration implements WebMvcConfigurer {
    private final String[] origins;
    public WebConfiguration(@Value("${creative.allowed-origins}") String origins) {
        this.origins=Arrays.stream(origins.split(",")).map(String::trim).filter(s->!s.isEmpty()).toArray(String[]::new);
    }
    @Override public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**").allowedOrigins(origins).allowedMethods("GET","POST","OPTIONS")
            .allowedHeaders("Content-Type").maxAge(600);
    }
}
