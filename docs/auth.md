## Auth API Spec

## Register User

Endpoint : POST /auth/register

Request Body :

```json
{
  "no_pegawai": "123456, optional",
  "nik": "1234567890",
  "email": "johndoe@example.com",
  "name": "Jogn Doe",
  "password": "rahasia",
  "dinas": "TU"
}
```

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "id": 1,
    "no_peg": "12345",
    "email": "johndoe@example.com",
    "name": "Jogn Doe",
    "dinas": "TU",
    "link": {
      "self": "/auth/current",
      "update": "/auth/current",
      "logout": "/auth/current"
    }
  }
}
```

Response Body (fail) :

```json
{
  "code": "400",
  "status": "BAD_REQUEST",
  "errors": {
    "id": ["", ""],
    "name": ["", ""]
  }
}
```

## Login User

Endpoint : POST /auth/login

Request Body :

```json
{
  "identifier": "johndoe@example.com, 12345",
  "password": "rahasia"
}
```

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "id": 1,
    "email": "johndoe@example.com",
    "name": "Jogn Doe",
    "dinas": "TU",
    "role": "super admin",
    "no_peg": "12345",
    "token": "session_id_generated",
    "link": {
      "self": "/auth/current",
      "update": "/auth/current",
      "logout": "/auth/current"
    }
  }
}
```

Response Body (fail) :

```json
{
  "code": "404",
  "status": "NOT_FOUND",
  "errors": {
    "id": [""],
    "name": [""]
  }
}
```

## Get User Current

Endpoint : GET /auth/me

Headers :

- Authorization : token

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "id": 1,
    "no_pegawai": "12345",
    "email": "johndoe@example.com",
    "name": "Jogn Doe",
    "dinas": "TU",
    "roleId": 4,
    "no_peg": "12345",
    "role": {
      "id": 2,
      "role": "super admin"
    },
    "link": {
      "self": "/auth/current",
      "update": "/auth/current",
      "logout": "/auth/current"
    }
  }
}
```

Response Body (fail) :

```json
{
  "code": "401",
  "status": "UNAUTHORIZED",
  "errors": ""
}
```

## Update User Current

Endpoint : PATCH /auth/me

Headers :

- Authorization : token

Request Body :

```json
{
  "no_peg": "12345, optional",
  "email": "johndoe@example.com, optional",
  "name": "John Doe, optional",
  "password": "rahasia, optional",
  "dinas": "TU, optional",
  "role": "super admin, optional"
}
```

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "id": 1,
    "email": "johndoe@example.com",
    "name": "Jogn Doe",
    "dinas": "TU",
    "role": "super admin",
    "no_peg": "12345",
    "link": {
      "self": "/auth/current",
      "update": "/auth/current",
      "logout": "/auth/current"
    }
  }
}
```

Response Body (fail) :

```json
{
  "code": "404",
  "status": "NOT_FOUND",
  "errors": {
    "id": [""],
    "name": [""]
  }
}
```

## Logout User

Endpoint : DELETE /auth/me

Headers :

- Authorization : token

Response Body (success) :

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
  "code": "500",
  "status": "SERVER_ERROR",
  "errors": ""
}
```
