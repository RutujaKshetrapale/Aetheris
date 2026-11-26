using System.Text.Json;
using System.Text.Json.Serialization;
using Aetheris.Adapters.Persistence;
using Aetheris.Adapters.Web;
using Aetheris.Application;
using Aetheris.Core.Algorithm;
using Aetheris.Core.Ports;

namespace Aetheris;

public static class AetherisAppFactory
{
    public static WebApplication BuildApp(string[]? args = null, IDictionary<string, string?>? configOverrides = null)
    {
        var builder = WebApplication.CreateBuilder(args ?? Array.Empty<string>());

        if (configOverrides != null)
        {
            builder.Configuration.AddInMemoryCollection(configOverrides);
        }

        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddOpenApi();

        builder.Services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false));
        });

        string? corsOrigins = Environment.GetEnvironmentVariable("AETHERIS_CORS_ALLOWED_ORIGINS")
            ?? builder.Configuration["Aetheris:Cors:AllowedOrigins"];

        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AetherisCors", policy =>
            {
                if (string.IsNullOrWhiteSpace(corsOrigins) || corsOrigins.Trim() == "*")
                {
                    policy.AllowAnyOrigin()
                          .AllowAnyMethod()
                          .AllowAnyHeader();
                }
                else
                {
                    var origins = corsOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    policy.WithOrigins(origins)
                          .AllowAnyMethod()
                          .AllowAnyHeader();
                }
            });
        });

        builder.Services.AddSingleton<PathfindingEngine>();
        builder.Services.AddSingleton<InMemoryPresetAdapter>();
        builder.Services.AddSingleton<InMemoryBenchmarkAdapter>();

        builder.Services.AddSingleton<IPresetRepository>(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            string engine = config["Aetheris:Persistence:Engine"] ?? "IN_MEMORY";

            if (string.Equals(engine, "MYSQL", StringComparison.OrdinalIgnoreCase))
                return new MySqlPresetAdapter(config);
            if (string.Equals(engine, "MONGODB", StringComparison.OrdinalIgnoreCase))
                return new MongoPresetAdapter(config);

            return sp.GetRequiredService<InMemoryPresetAdapter>();
        });

        builder.Services.AddSingleton<IBenchmarkRepository>(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            string engine = config["Aetheris:Persistence:Engine"] ?? "IN_MEMORY";

            if (string.Equals(engine, "MYSQL", StringComparison.OrdinalIgnoreCase))
                return new MySqlBenchmarkAdapter();
            if (string.Equals(engine, "MONGODB", StringComparison.OrdinalIgnoreCase))
                return new MongoBenchmarkAdapter();

            return sp.GetRequiredService<InMemoryBenchmarkAdapter>();
        });

        builder.Services.AddSingleton<PresetBundleCodec>();
        builder.Services.AddSingleton<PathfindingApplicationService>();
        builder.Services.AddSingleton<PresetApplicationService>();
        builder.Services.AddSingleton<BenchmarkApplicationService>();
        builder.Services.AddSingleton<HealthApplicationService>();

        var app = builder.Build();

        app.UseCors("AetherisCors");
        app.UseMiddleware<GlobalExceptionMiddleware>();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }

        app.MapAetherisEndpoints();
        return app;
    }
}
