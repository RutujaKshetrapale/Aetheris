package com.aetheris.adapter.persistence.mongo;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

import java.util.concurrent.TimeUnit;

@Configuration
@ConditionalOnProperty(name = "aetheris.persistence.engine", havingValue = "MONGODB")
@EnableMongoRepositories(
        basePackageClasses = SpringDataPresetMongoRepository.class,
        mongoTemplateRef = "mongoTemplate"
)
public class MongoPersistenceConfig {

    public record MongoHealthProbe(MongoTemplate mongoTemplate, boolean configValid, String configError) {
        public boolean isDatabaseConnected() {
            if (!configValid || mongoTemplate == null) {
                return false;
            }
            try {
                Document result = mongoTemplate.executeCommand(new Document("ping", 1));
                Object ok = result.get("ok");
                return ok instanceof Number n && n.doubleValue() == 1.0;
            } catch (Exception ex) {
                return false;
            }
        }
    }

    @Bean
    public MongoHealthProbe mongoHealthProbe(
            @Value("${aetheris.persistence.mongodb.uri:}") String uri,
            @Value("${aetheris.persistence.mongodb.database:aetheris}") String database,
            @Value("${aetheris.persistence.mongodb.connect-timeout-ms:2000}") int connectTimeoutMs) {

        if (uri == null || uri.isBlank() || database == null || database.isBlank()) {
            return new MongoHealthProbe(null, false, "Required MongoDB configuration (URI and database name) is incomplete.");
        }

        try {
            int timeoutMs = Math.max(500, connectTimeoutMs);
            ConnectionString connectionString = new ConnectionString(uri.trim());
            MongoClientSettings settings = MongoClientSettings.builder()
                    .applyConnectionString(connectionString)
                    .applyToClusterSettings(b -> b.serverSelectionTimeout(timeoutMs, TimeUnit.MILLISECONDS))
                    .applyToSocketSettings(b -> b
                            .connectTimeout(timeoutMs, TimeUnit.MILLISECONDS)
                            .readTimeout(Math.max(3000, timeoutMs), TimeUnit.MILLISECONDS))
                    .build();

            MongoClient client = MongoClients.create(settings);
            MongoTemplate template = new MongoTemplate(client, database.trim());
            return new MongoHealthProbe(template, true, null);
        } catch (Exception ex) {
            return new MongoHealthProbe(null, false, "Invalid MongoDB URI configuration.");
        }
    }

    @Bean(name = "mongoTemplate")
    public MongoTemplate mongoTemplate(MongoHealthProbe probe) {
        if (probe.mongoTemplate() != null) {
            return probe.mongoTemplate();
        }
        MongoClientSettings fallback = MongoClientSettings.builder()
                .applyToClusterSettings(b -> b.serverSelectionTimeout(200, TimeUnit.MILLISECONDS))
                .build();
        return new MongoTemplate(MongoClients.create(fallback), "aetheris");
    }
}
