# Role API Spec

## Create Role

Endpoint : POST api/roles

Headers :

- Authorization : token

Request Body :

```json
{
  "role": "super admin"
}
```

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "id": 1,
    "role": "super admin"
  }
}
```

Response Body (fail) :

```json
{
  "code": "400",
  "status": "BAD_REQUEST",
  "errors": ""
}
```

## Get All role

Endpoint : GET api/roles

Headers :

- Authorization : token

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": [
    {
      "id": 1,
      "role": "super admin"
    },
    {
      "id": 2,
      "role": "supervison"
    },
    {
      "id": 3,
      "role": "LCU"
    },
    {
      "id": 4,
      "role": "user"
    }
  ]
}
```

Response Body (fail) :

```json
{
  "code": "404",
  "status": "NOT_FOUND",
  "errors": ""
}
```

## Get Role By Id

Endpoint : GET api/roles/:roleId

Headers :

- Authorization : token

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "id": 1,
    "role": "super admin"
  }
}
```

Response Body (fail) :

```json
{
  "code": "404",
  "status": "NOT_FOUND",
  "errors": ""
}
```

## Update Role

Endpoint : PUT api/roles/:roleId

Headers :

- Authorization : token

Request Body :

```json
{
  "role": "LCU"
}
```

Response Body :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "id": 1,
    "role": "LCU"
  }
}
```

Response Body (fail) :

```json
{
  "code": "400",
  "status": "BAD_REQUEST",
  "errors": ""
}
```

## Delete Role

Endpoint : DELETE api/roles/:roleId

Headers :

- Authorization : token

Response Body :

```json
{
  "code": "200",
  "status": "OK",
  "data": true
}
```

Response Body (fail) :

```json
{
  "code": "400",
  "status": "BAD_REQUEST",
  "errors": ""
}
```
