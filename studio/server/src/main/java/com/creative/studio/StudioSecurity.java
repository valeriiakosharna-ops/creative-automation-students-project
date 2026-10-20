package com.creative.studio;

import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;

@Configuration
public class StudioSecurity {
    @Bean InMemoryUserDetailsManager noPasswordAccounts(){return new InMemoryUserDetailsManager();}
    @Bean @Profile("!corporate") SecurityFilterChain developmentSecurity(HttpSecurity http) throws Exception {
        return http.csrf(csrf->csrf.disable()).authorizeHttpRequests(r->r.anyRequest().permitAll()).build();
    }
}
