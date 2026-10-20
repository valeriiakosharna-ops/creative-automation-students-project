package com.creative.studio;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.*;
import java.nio.charset.StandardCharsets;

@Component
public class RequestLimitFilter extends OncePerRequestFilter {
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        if(!request.getMethod().equals("POST")||!request.getRequestURI().endsWith("/api/copy")){chain.doFilter(request,response);return;}
        byte[] body=request.getInputStream().readNBytes(65537);
        if(body.length>65536){response.setStatus(413);response.setContentType("application/json");response.getWriter().write("{\"message\":\"The text brief exceeds the 64 KB request limit. Images must stay in the browser.\"}");return;}
        var wrapped=new HttpServletRequestWrapper(request) {
            @Override public ServletInputStream getInputStream(){var stream=new ByteArrayInputStream(body);return new ServletInputStream(){
                @Override public int read(){return stream.read();}
                @Override public boolean isFinished(){return stream.available()==0;}
                @Override public boolean isReady(){return true;}
                @Override public void setReadListener(ReadListener listener){throw new UnsupportedOperationException("Synchronous request body");}
            };}
            @Override public BufferedReader getReader(){return new BufferedReader(new InputStreamReader(getInputStream(),StandardCharsets.UTF_8));}
        };
        chain.doFilter(wrapped,response);
    }
}
