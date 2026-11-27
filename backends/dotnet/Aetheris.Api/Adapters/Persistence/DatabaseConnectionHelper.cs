using System.Globalization;
using MongoDB.Bson;
using MongoDB.Driver;
using MySqlConnector;

namespace Aetheris.Adapters.Persistence;

public sealed class MySqlConnectionContext
{
    public string? ConnectionString { get; }
    public bool IsConfigValid { get; }
    public string? ConfigError { get; }
    public int ConnectTimeoutMs { get; }

    public MySqlConnectionContext(IConfiguration configuration)
    {
        ConnectTimeoutMs = Math.Max(500, configuration.GetValue<int?>("Aetheris:Persistence:ConnectTimeoutMs") ?? 2000);

        string? explicitConn = configuration.GetConnectionString("MySql")
            ?? configuration["Aetheris:Persistence:MySql:ConnectionString"];

        if (!string.IsNullOrWhiteSpace(explicitConn))
        {
            var builder = new MySqlConnectionStringBuilder(explicitConn)
            {
                ConnectionTimeout = (uint)Math.Max(1, ConnectTimeoutMs / 1000),
                DefaultCommandTimeout = 5
            };
            ConnectionString = builder.ConnectionString;
            IsConfigValid = true;
            return;
        }

        string? host = configuration["Aetheris:Persistence:MySql:Host"] ?? configuration["AETHERIS_MYSQL_HOST"];
        string? database = configuration["Aetheris:Persistence:MySql:Database"] ?? configuration["AETHERIS_MYSQL_DATABASE"];
        string? username = configuration["Aetheris:Persistence:MySql:Username"] ?? configuration["AETHERIS_MYSQL_USER"];
        string? password = configuration["Aetheris:Persistence:MySql:Password"] ?? configuration["AETHERIS_MYSQL_PASSWORD"];
        uint port = configuration.GetValue<uint?>("Aetheris:Persistence:MySql:Port")
            ?? (uint.TryParse(configuration["AETHERIS_MYSQL_PORT"], out var parsedPort) ? parsedPort : 3306);

        if (string.IsNullOrWhiteSpace(host) ||
            string.IsNullOrWhiteSpace(database) ||
            string.IsNullOrWhiteSpace(username) ||
            string.IsNullOrWhiteSpace(password))
        {
            IsConfigValid = false;
            ConfigError = "Required MySQL configuration (connection string or host, database, username, password) is incomplete.";
            return;
        }

        var csBuilder = new MySqlConnectionStringBuilder
        {
            Server = host.Trim(),
            Port = port,
            Database = database.Trim(),
            UserID = username.Trim(),
            Password = password,
            ConnectionTimeout = (uint)Math.Max(1, ConnectTimeoutMs / 1000),
            DefaultCommandTimeout = 5,
            AllowPublicKeyRetrieval = true,
            SslMode = MySqlSslMode.Preferred
        };
        ConnectionString = csBuilder.ConnectionString;
        IsConfigValid = true;
    }

    public MySqlConnection CreateConnection()
    {
        if (!IsConfigValid || string.IsNullOrWhiteSpace(ConnectionString))
        {
            throw new InvalidOperationException(ConfigError ?? "MySQL configuration is invalid.");
        }
        return new MySqlConnection(ConnectionString);
    }

    public bool IsDatabaseConnected()
    {
        if (!IsConfigValid || string.IsNullOrWhiteSpace(ConnectionString))
        {
            return false;
        }
        try
        {
            using var cts = new CancellationTokenSource(ConnectTimeoutMs);
            using var conn = new MySqlConnection(ConnectionString);
            conn.OpenAsync(cts.Token).GetAwaiter().GetResult();
            using var cmd = new MySqlCommand("SELECT 1", conn);
            cmd.CommandTimeout = Math.Max(1, ConnectTimeoutMs / 1000);
            cmd.ExecuteScalarAsync(cts.Token).GetAwaiter().GetResult();
            return true;
        }
        catch
        {
            return false;
        }
    }
}

public sealed class MongoConnectionContext
{
    public IMongoDatabase? Database { get; }
    public bool IsConfigValid { get; }
    public string? ConfigError { get; }
    public int ConnectTimeoutMs { get; }

    public MongoConnectionContext(IConfiguration configuration)
    {
        ConnectTimeoutMs = Math.Max(500, configuration.GetValue<int?>("Aetheris:Persistence:ConnectTimeoutMs") ?? 2000);

        string? uri = configuration.GetConnectionString("Mongo")
            ?? configuration["Aetheris:Persistence:MongoDb:Uri"]
            ?? configuration["AETHERIS_MONGODB_URI"];
        string? dbName = configuration["Aetheris:Persistence:MongoDb:Database"]
            ?? configuration["AETHERIS_MONGODB_DATABASE"]
            ?? "aetheris";

        if (string.IsNullOrWhiteSpace(uri) || string.IsNullOrWhiteSpace(dbName))
        {
            IsConfigValid = false;
            ConfigError = "Required MongoDB configuration (URI and database name) is incomplete.";
            return;
        }

        try
        {
            var settings = MongoClientSettings.FromConnectionString(uri.Trim());
            settings.ConnectTimeout = TimeSpan.FromMilliseconds(ConnectTimeoutMs);
            settings.ServerSelectionTimeout = TimeSpan.FromMilliseconds(ConnectTimeoutMs);
            settings.SocketTimeout = TimeSpan.FromMilliseconds(Math.Max(3000, ConnectTimeoutMs));

            var client = new MongoClient(settings);
            Database = client.GetDatabase(dbName.Trim());
            IsConfigValid = true;
        }
        catch
        {
            IsConfigValid = false;
            ConfigError = "Invalid MongoDB URI configuration.";
        }
    }

    public bool IsDatabaseConnected()
    {
        if (!IsConfigValid || Database == null)
        {
            return false;
        }
        try
        {
            using var cts = new CancellationTokenSource(ConnectTimeoutMs);
            var result = Database.RunCommand<BsonDocument>(new BsonDocument("ping", 1), cancellationToken: cts.Token);
            return result.TryGetValue("ok", out var okVal) && okVal.ToDouble() == 1.0;
        }
        catch
        {
            return false;
        }
    }
}

internal static class PersistenceTimeHelper
{
    public static DateTime ParseUtcOrNow(string? isoTimestamp, DateTime fallbackUtc)
    {
        if (!string.IsNullOrWhiteSpace(isoTimestamp) &&
            DateTime.TryParse(isoTimestamp, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var parsed))
        {
            return DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
        }
        return DateTime.SpecifyKind(fallbackUtc, DateTimeKind.Utc);
    }

    public static string ToIsoUtc(DateTime dt)
    {
        var utc = dt.Kind == DateTimeKind.Utc ? dt : DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        return utc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture);
    }
}
