# Magic V2Ray v1.25 Release Notes

Introduces critical improvements to DNS traffic routing, rule prioritization, and user interface stability.

This update reorganizes routing rules to place user-defined rules and client DNS routing ahead of standard DNS rules, ensuring that custom configurations are correctly prioritized. When DNS hijacking is active, client DNS rules are now prioritized at the top of the routing stack to prevent traffic from being intercepted prematurely. Additionally, the header layout has been refined to streamline the service status display and layout presentation.

---

[Click here for older release notes](https://github.com/vincentng295/Magic_V2Ray/releases)