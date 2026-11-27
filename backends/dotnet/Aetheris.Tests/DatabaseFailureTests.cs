using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Aetheris.Tests;

public class DatabaseFailureTests
{
    [Fact]
    public async Task MongoUnavailableReturns503WhilePathfindingRemains200()
    {
        var app = AetherisAppFactory.BuildApp(
            new[] { "--urls", "http://127.0.0.1:0" },
            new Dictionary<string, string?>
            {
                ["Aetheris:Persistence:Engine"] = "MONGODB",
                ["Aetheris:Persistence:ConnectTimeoutMs"] = "500",
                ["Aetheris:Persistence:MongoDb:Uri"] = "mongodb://127.0.0.1:59999/aetheris",
                ["Aetheris:Persistence:MongoDb:Database"] = "aetheris"
            });

        await app.StartAsync();
        try
        {
            var server = app.Services.GetRequiredService<IServer>();
            var baseUrl = server.Features.Get<IServerAddressesFeature>()!.Addresses.First();
            using var client = new HttpClient { BaseAddress = new Uri(baseUrl) };

            var health = await client.GetAsync("/api/v1/health");
            Assert.Equal(HttpStatusCode.OK, health.StatusCode);
            using var doc = JsonDocument.Parse(await health.Content.ReadAsStringAsync());
            Assert.Equal("MONGODB", doc.RootElement.GetProperty("persistenceEngine").GetString());
            Assert.Equal("UNAVAILABLE", doc.RootElement.GetProperty("persistenceStatus").GetString());
            Assert.False(doc.RootElement.GetProperty("databaseConnected").GetBoolean());

            var ready = await client.GetAsync("/api/v1/health/ready");
            Assert.Equal(HttpStatusCode.OK, ready.StatusCode);

            var traceResp = await client.PostAsync(
                "/api/v1/pathfinding/trace",
                new StringContent("{\"algorithm\":\"BFS\",\"grid\":{\"rows\":3,\"cols\":3,\"startNode\":\"r0c0\",\"targetNode\":\"r2c2\"}}", Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.OK, traceResp.StatusCode);

            var presetsResp = await client.GetAsync("/api/v1/presets");
            Assert.Equal(HttpStatusCode.ServiceUnavailable, presetsResp.StatusCode);
            Assert.Equal("application/problem+json", presetsResp.Content.Headers.ContentType?.MediaType);
        }
        finally
        {
            await app.StopAsync();
            await app.DisposeAsync();
        }
    }

    [Fact]
    public void InvalidPersistenceEngineThrowsClearException()
    {
        var ex = Assert.Throws<InvalidOperationException>(() =>
            AetherisAppFactory.BuildApp(
                new[] { "--urls", "http://127.0.0.1:0" },
                new Dictionary<string, string?>
                {
                    ["Aetheris:Persistence:Engine"] = "POSTGRES"
                }));

        Assert.Contains("Unsupported Aetheris:Persistence:Engine", ex.Message);
    }
}
