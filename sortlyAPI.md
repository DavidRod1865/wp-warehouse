# Items/Folders

## Create an Item/Folder

 - [POST /api/v1/items](https://developer.sortly.com/itemsfolders/create%20an%20item.md)

## List Items/Folders

 - [GET /api/v1/items](https://developer.sortly.com/itemsfolders/list%20items.md)

## Recent Items/Folders List

 - [GET /api/v1/items/recent](https://developer.sortly.com/itemsfolders/recent%20items%20list.md)

## Delete Item/Folder

 - [DELETE /api/v1/items/{item_id}](https://developer.sortly.com/itemsfolders/delete%20item.md)

## Fetch Item/Folder

 - [GET /api/v1/items/{item_id}](https://developer.sortly.com/itemsfolders/fetch%20item.md)

## Update Item/Folder

 - [PUT /api/v1/items/{item_id}](https://developer.sortly.com/itemsfolders/update%20item.md)

## Move an Item/Folder

 - [POST /api/v1/items/{item_id}/move](https://developer.sortly.com/itemsfolders/move%20an%20item.md)

## Clone an Item/Folder

 - [POST /api/v1/items/{item_id}/copy](https://developer.sortly.com/itemsfolders/clone%20an%20item.md)

## Search Items/Folders

 - [POST /api/v1/items/search](https://developer.sortly.com/itemsfolders/search%20items.md)

# Custom Fields

## List Custom Fields

 - [GET /api/v1/custom_fields](https://developer.sortly.com/custom-fields/list%20custom%20fields.md)

# Alerts

## List Alerts

 - [GET /api/v1/alerts](https://developer.sortly.com/alerts/list%20alerts.md)

## Create an Alert

 - [POST /api/v1/alerts](https://developer.sortly.com/alerts/create%20an%20alert.md)

## Update an Alert

 - [PUT /api/v1/alerts/{alert_id}](https://developer.sortly.com/alerts/update%20an%20alert.md)

## Delete Alert

 - [DELETE /api/v1/alerts/{alert_id}](https://developer.sortly.com/alerts/delete%20alert.md)

# Sortly API

Sortly API can be used to manage items and folders in your [Sortly](https://app.sortly.com/login) account.
Our API is organized around REST. It returns JSON-encoded responses and uses standard HTTP response codes.
This API is only available on **Sortly Enterprise Plan** subscription.

NOTE:

- This feature is currently under *beta*. Please expect minor updates in the near future.

- Contact [dev-support@sortly.com](mailto:dev-support@sortly.com) for developer support.
## Authentication

Authentication to the API is performed via OAuth 2.0. Under this, you must provide your secret key as the `Bearer` token in the Authorization header.
All requests must be made over HTTPS.

##### Getting Started

- Visit: [https://app.sortly.com/public-api](https://app.sortly.com/public-api) to obtain an API access key pair for your account.

- Use the secret key as the `Bearer` token.

## Rate Limiting

Sortly API calls are rate limited. You can make 1000 requests per API in a 15-minute window. Rate limit information in available in the HTTP headers of the API response.

|Header|Description|
|---------|-------------|
|`Sortly-Rate-Limit-Max`|Maximum number of requests allowed within the 15-minute window |
|`Sortly-Rate-Limit-Remaining`|Number of requests remaining in the current 15-minute window   |
|`Sortly-Rate-Limit-Reset`|The time at which the current rate limit window resets.(in seconds) |

Once you go over the rate limit you will receive a HTTP 429 Too Many Requests error response.

Version: 1.0.0

## Servers

```
https://api.sortly.co
```

## Download OpenAPI description

[Sortly API](https://developer.sortly.com/_bundle/index.yaml)