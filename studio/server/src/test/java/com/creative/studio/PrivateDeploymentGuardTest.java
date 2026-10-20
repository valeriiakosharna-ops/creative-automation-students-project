package com.creative.studio;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.mock.env.MockEnvironment;
import static org.junit.jupiter.api.Assertions.*;

class PrivateDeploymentGuardTest {
    void check(String... profiles) {
        var environment=new MockEnvironment().withProperty("STUDIO_REQUIRE_PRIVATE","true");environment.setActiveProfiles(profiles);
        var guard=new PrivateDeploymentGuard();guard.setEnvironment(environment);guard.postProcessBeanFactory(new DefaultListableBeanFactory());
    }
    @Test void privateImageCannotFallBackToPublicOrMixedProfiles() {
        assertThrows(IllegalStateException.class,()->check());
        assertThrows(IllegalStateException.class,()->check("hosted"));
        assertThrows(IllegalStateException.class,()->check("corporate","hosted"));
        assertDoesNotThrow(()->check("corporate"));
    }
    @Test void corporateModeCannotEnableVisitorKeysThroughAnOverride() {
        var environment=new MockEnvironment().withProperty("creative.openai.client-keys-enabled","true");environment.setActiveProfiles("corporate");
        var guard=new PrivateDeploymentGuard();guard.setEnvironment(environment);
        assertThrows(IllegalStateException.class,()->guard.postProcessBeanFactory(new DefaultListableBeanFactory()));
    }
}
