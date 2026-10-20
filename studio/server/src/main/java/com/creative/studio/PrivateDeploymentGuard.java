package com.creative.studio;

import org.springframework.beans.factory.config.*;
import org.springframework.context.EnvironmentAware;
import org.springframework.core.env.*;
import org.springframework.stereotype.Component;

/** Check before the web server can start, rather than opening an unsafe fallback. */
@Component
public class PrivateDeploymentGuard implements BeanFactoryPostProcessor,EnvironmentAware {
    private Environment environment;
    @Override public void setEnvironment(Environment environment){this.environment=environment;}
    @Override public void postProcessBeanFactory(ConfigurableListableBeanFactory beans) {
        if(Boolean.parseBoolean(environment.getProperty("STUDIO_REQUIRE_PRIVATE","false"))&&!environment.acceptsProfiles(Profiles.of("corporate")))
            throw new IllegalStateException("This deployment requires the corporate security profile. No public fallback was started.");
        if(environment.acceptsProfiles(Profiles.of("corporate"))&&(environment.acceptsProfiles(Profiles.of("hosted"))||Boolean.parseBoolean(environment.getProperty("creative.openai.client-keys-enabled","false"))))
            throw new IllegalStateException("Corporate deployments cannot enable the public hosted profile or browser-supplied API keys.");
    }
}
