package com.aetheris.adapter.persistence.mysql;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.persistence.EntityManagerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.util.Properties;

@Configuration
@ConditionalOnProperty(name = "aetheris.persistence.engine", havingValue = "MYSQL")
@EnableTransactionManagement
@EnableJpaRepositories(
        basePackageClasses = SpringDataPresetJpaRepository.class,
        entityManagerFactoryRef = "mysqlEntityManagerFactory",
        transactionManagerRef = "mysqlTransactionManager"
)
public class MySqlPersistenceConfig {

    public record MySqlHealthProbe(DataSource dataSource, boolean configValid, String configError) {
        public boolean isDatabaseConnected() {
            if (!configValid || dataSource == null) {
                return false;
            }
            try (Connection conn = dataSource.getConnection();
                 Statement stmt = conn.createStatement()) {
                stmt.setQueryTimeout(2);
                stmt.execute("SELECT 1");
                return true;
            } catch (Exception ex) {
                return false;
            }
        }
    }

    @Bean
    public MySqlHealthProbe mysqlHealthProbe(
            @Value("${aetheris.persistence.mysql.url:}") String url,
            @Value("${aetheris.persistence.mysql.host:}") String host,
            @Value("${aetheris.persistence.mysql.port:3306}") int port,
            @Value("${aetheris.persistence.mysql.database:}") String database,
            @Value("${aetheris.persistence.mysql.username:}") String username,
            @Value("${aetheris.persistence.mysql.password:}") String password,
            @Value("${aetheris.persistence.mysql.connect-timeout-ms:2000}") int connectTimeoutMs) {

        String resolvedUrl = resolveJdbcUrl(url, host, port, database, connectTimeoutMs);
        if (resolvedUrl == null || username == null || username.isBlank() || password == null || password.isBlank()) {
            return new MySqlHealthProbe(null, false, "Required MySQL configuration (URL/host, username, password) is incomplete.");
        }

        HikariConfig hikari = new HikariConfig();
        hikari.setJdbcUrl(resolvedUrl);
        hikari.setUsername(username);
        hikari.setPassword(password);
        hikari.setDriverClassName("com.mysql.cj.jdbc.Driver");
        hikari.setPoolName("aetheris-mysql-pool");
        hikari.setMaximumPoolSize(10);
        hikari.setMinimumIdle(1);
        hikari.setConnectionTimeout(Math.max(500, connectTimeoutMs));
        hikari.setValidationTimeout(Math.max(500, connectTimeoutMs));
        hikari.setInitializationFailTimeout(-1);
        return new MySqlHealthProbe(new HikariDataSource(hikari), true, null);
    }

    @Bean
    public DataSource mysqlDataSource(MySqlHealthProbe probe) {
        if (probe.dataSource() != null) {
            return probe.dataSource();
        }
        // Dummy unconfigured DataSource placeholder so JPA bean graph initializes cleanly;
        // MySqlHealthProbe.isDatabaseConnected() returns false and adapters throw 503.
        HikariConfig fallback = new HikariConfig();
        fallback.setJdbcUrl("jdbc:mysql://127.0.0.1:0/unconfigured");
        fallback.setInitializationFailTimeout(-1);
        fallback.setConnectionTimeout(500);
        return new HikariDataSource(fallback);
    }

    @Bean(name = "mysqlEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean mysqlEntityManagerFactory(DataSource mysqlDataSource) {
        LocalContainerEntityManagerFactoryBean emf = new LocalContainerEntityManagerFactoryBean();
        emf.setDataSource(mysqlDataSource);
        emf.setPackagesToScan(PresetEntity.class.getPackageName());
        emf.setJpaVendorAdapter(new HibernateJpaVendorAdapter());

        Properties jpaProps = new Properties();
        jpaProps.put("hibernate.hbm2ddl.auto", "none");
        jpaProps.put("hibernate.dialect", "org.hibernate.dialect.MySQLDialect");
        jpaProps.put("hibernate.jdbc.time_zone", "UTC");
        emf.setJpaProperties(jpaProps);
        return emf;
    }

    @Bean(name = "mysqlTransactionManager")
    public PlatformTransactionManager mysqlTransactionManager(EntityManagerFactory mysqlEntityManagerFactory) {
        return new JpaTransactionManager(mysqlEntityManagerFactory);
    }

    static String resolveJdbcUrl(String url, String host, int port, String database, int connectTimeoutMs) {
        if (url != null && !url.isBlank()) {
            return url.trim();
        }
        if (host != null && !host.isBlank() && database != null && !database.isBlank()) {
            int timeout = Math.max(500, connectTimeoutMs);
            return String.format(
                    "jdbc:mysql://%s:%d/%s?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&connectTimeout=%d&socketTimeout=5000",
                    host.trim(), port, database.trim(), timeout);
        }
        return null;
    }
}
