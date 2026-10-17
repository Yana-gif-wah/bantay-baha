# Security, Ethics, and Emerging Tech Reflection

1. **Security Risks & Fixes:**
   First, the API allows unrestricted unauthenticated `POST` requests, meaning malicious users could submit fake flood readings. To fix this, I would implement API Key authentication or JWT tokens for IoT endpoints. Second, there is no rate limiting on the `/api/advisory` endpoint, exposing it to Denial-of-Service (DoS) attacks and high API costs; I would resolve this by adding `express-rate-limit`.

2. **AI Advisory Responsibility & Safeguards:**
   The development team and local disaster management office bear legal and moral responsibility for incorrect AI advisories. To prevent harm, I implemented a rule-based fallback mechanism that activates if the AI fails, along with strict system prompt constraints ensuring the AI relies exclusively on provided numeric metrics rather than generating unverified assumptions.

3. **Emerging Tech (Blockchain):**
   Blockchain technology could be used to create an immutable, tamper-proof audit trail of flood readings across multiple barangays, ensuring data transparency. However, it is not worth the cost because standard encrypted relational databases provide sufficient trust at a fraction of the computational and financial expense for a localized community project.

4. **Big Data Analytics Impact (200 Sensors):**
   Scaling to 200 sensors across Metro Manila transforms the architecture from simple in-memory arrays to high-throughput streaming databases (like Apache Kafka and InfluxDB). It enables real-time spatial heatmaps, predictive machine learning models for city-wide river systems, and automated regional emergency routing instead of basic single-sensor stats.