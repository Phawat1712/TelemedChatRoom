import * as signalR from '@microsoft/signalr';

export const chatConnection = new signalR.HubConnectionBuilder()
  .withUrl('http://119.59.114.31:9060/hubs/chat', {
    skipNegotiation: true,
    transport: signalR.HttpTransportType.WebSockets,
  })
  .withAutomaticReconnect()
  .configureLogging(signalR.LogLevel.Information)
  .build();