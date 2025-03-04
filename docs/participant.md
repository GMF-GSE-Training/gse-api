# Participant API Spec

## Create Participant

Endpoint : POST /participants

Headers :

- Authorization : token

Request Body :

```json
{
  "no_pegawai": "12345",
  "name": "John Doe",
  "dinas": "TU",
  "bidang": "TLC-4",
  "perusahaan": "GMF",
  "email": "johndoe@gmail.com",
  "no_telp": "08123456789",
  "Kewarganegaraan": "Indonesia",
  "tempat_lahir": "Jakarta",
  "tanggal_lahir": "2024/01/01",
  "sim_a": "sim_a.jpg",
  "sim_b": "sim_b.jpd",
  "ktp": "ktp.jpg",
  "foto": "foto.jpg",
  "surat_sehat_buta_warna": "surat_sehat.jpg",
  "exp_surat_sehat": "2024/01/01",
  "surat_bebas_narkoba": "bebas_narkoba.jpg",
  "exp_bebas_narkoba": "2024/01/01",
  "gmf_nongmf": "GMF"
}
```

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "no_pegawai": "12345",
    "name": "John Doe",
    "dinas": "TU",
    "bidang": "TLC-4",
    "perusahaan": "GMF",
    "email": "johndoe@gmail.com",
    "no_telp": "08123456789",
    "Kewarganegaraan": "Indonesia",
    "tempat_lahir": "Jakarta",
    "tanggal_lahir": "2024/01/01",
    "sim_a": "base64",
    "sim_b": "base64",
    "ktp": "base64",
    "foto": "base64",
    "surat_sehat_buta_warna": "base64",
    "exp_surat_sehat": "2024/01/01",
    "surat_bebas_narkoba": "base64",
    "exp_bebas_narkoba": "2024/01/01",
    "gmf_nongmf": "GMF",
    "link_qr_code": "https://example.com",
    "qr_code": "base64",
    "link": {
      "self": "/participants/1",
      "update": "/participants/1",
      "delete": "/participants/1"
    }
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

## List Participants

Endpoint : POST /participants

Headers :

- Authorization : token

Response Body :

```json
{
  "code": "200",
  "status": "OK",
  "data": [
    {
      "no_pegawai": "12345",
      "name": "John Doe",
      "dinas": "TU",
      "bidang": "TLC-4",
      "perusahaan": "GMF",
      "email": "johndoe@gmail.com",
      "no_telp": "08123456789",
      "Kewarganegaraan": "Indonesia",
      "tempat_lahir": "Jakarta",
      "tanggal_lahir": "2024/01/01",
      "sim_a": "base64",
      "sim_b": "base64",
      "ktp": "base64",
      "foto": "base64",
      "surat_sehat_buta_warna": "base64",
      "exp_surat_sehat": "2024/01/01",
      "surat_bebas_narkoba": "base64",
      "exp_bebas_narkoba": "2024/01/01",
      "gmf_nongmf": "GMF",
      "link_qr_code": "https://example.com",
      "qr_code": "base64",
      "link": {
        "self": "/participants/1",
        "update": "/participants/1",
        "delete": "/participants/1"
      }
    },
    {
      "no_pegawai": "12345",
      "name": "John Doe",
      "dinas": "TU",
      "bidang": "TLC-4",
      "perusahaan": "GMF",
      "email": "johndoe@gmail.com",
      "no_telp": "08123456789",
      "Kewarganegaraan": "Indonesia",
      "tempat_lahir": "Jakarta",
      "tanggal_lahir": "2024/01/01",
      "sim_a": "base64",
      "sim_b": "base64",
      "ktp": "base64",
      "foto": "base64",
      "surat_sehat_buta_warna": "base64",
      "exp_surat_sehat": "2024/01/01",
      "surat_bebas_narkoba": "base64",
      "exp_bebas_narkoba": "2024/01/01",
      "gmf_nongmf": "GMF",
      "link_qr_code": "https://example.com",
      "qr_code": "base64",
      "link": {
        "self": "/participants/1",
        "update": "/participants/1",
        "delete": "/participants/1"
      }
    }
  ],
  "paging": {
    "current_page": 1,
    "total_page": 10,
    "size": 100,
    "links": {
      "next": "/participants/list/result?page=2&size=10",
      "prev": null
    }
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

## Get Participant

Endpoint : POST /participants/:participantId

Headers :

- Authorization : token

Response Body :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "no_pegawai": "12345",
    "name": "John Doe",
    "dinas": "TU",
    "bidang": "TLC-4",
    "perusahaan": "GMF",
    "email": "johndoe@gmail.com",
    "no_telp": "08123456789",
    "Kewarganegaraan": "Indonesia",
    "tempat_lahir": "Jakarta",
    "tanggal_lahir": "2024/01/01",
    "sim_a": "base64",
    "sim_b": "base64",
    "ktp": "base64",
    "foto": "base64",
    "surat_sehat_buta_warna": "base64",
    "exp_surat_sehat": "2024/01/01",
    "surat_bebas_narkoba": "base64",
    "exp_bebas_narkoba": "2024/01/01",
    "gmf_nongmf": "GMF",
    "link_qr_code": "https://example.com",
    "qr_code": "base64",
    "link": {
      "self": "/participants/1",
      "update": "/participants/1",
      "delete": "/participants/1"
    }
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

## Update Participant

Endpoint : POST /participants/:participantId

Headers :

- Authorization : token

Request Body :

```json
{
  "no_pegawai": "12345, optional",
  "name": "John Doe, optional",
  "dinas": "TU, optional",
  "bidang": "TLC-4, optional",
  "perusahaan": "GMF, optional",
  "email": "johndoe@gmail.com, optional",
  "no_telp": "08123456789, optional",
  "Kewarganegaraan": "Indonesia, optional",
  "tempat_lahir": "Jakarta, optional",
  "tanggal_lahir": "2024/01/01, optional",
  "sim_a": "sim_a.jpg, optional",
  "sim_b": "sim_b.jpd, optional",
  "ktp": "ktp.jpg, optional",
  "foto": "foto.jpg, optional",
  "surat_sehat_buta_warna": "surat_sehat.jpg, optional",
  "exp_surat_sehat": "2024/01/01, optional",
  "surat_bebas_narkoba": "bebas_narkoba.jpg, optional",
  "exp_bebas_narkoba": "2024/01/01, optional",
  "gmf_nongmf": "GMF, optional"
}
```

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "no_pegawai": "12345",
    "name": "John Doe",
    "dinas": "TU",
    "bidang": "TLC-4",
    "perusahaan": "GMF",
    "email": "johndoe@gmail.com",
    "no_telp": "08123456789",
    "Kewarganegaraan": "Indonesia",
    "tempat_lahir": "Jakarta",
    "tanggal_lahir": "2024/01/01",
    "sim_a": "base64",
    "sim_b": "base64",
    "ktp": "base64",
    "foto": "base64",
    "surat_sehat_buta_warna": "base64",
    "exp_surat_sehat": "2024/01/01",
    "surat_bebas_narkoba": "base64",
    "exp_bebas_narkoba": "2024/01/01",
    "gmf_nongmf": "GMF",
    "link_qr_code": "https://example.com",
    "qr_code": "base64",
    "link": {
      "self": "/participants/1",
      "update": "/participants/1",
      "delete": "/participants/1"
    }
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

## Delete Participant

Endpoint : POST /participants/:participantId

Headers :

- Authorization : token

Response Body :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "no_pegawai": "12345",
    "name": "John Doe",
    "dinas": "TU",
    "bidang": "TLC-4",
    "perusahaan": "GMF",
    "email": "johndoe@gmail.com",
    "no_telp": "08123456789",
    "Kewarganegaraan": "Indonesia",
    "tempat_lahir": "Jakarta",
    "tanggal_lahir": "2024/01/01",
    "sim_a": "base64",
    "sim_b": "base64",
    "ktp": "base64",
    "foto": "base64",
    "surat_sehat_buta_warna": "base64",
    "exp_surat_sehat": "2024/01/01",
    "surat_bebas_narkoba": "base64",
    "exp_bebas_narkoba": "2024/01/01",
    "gmf_nongmf": "GMF",
    "link_qr_code": "https://example.com",
    "qr_code": "base64"
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

## Search Participant

Endpoint : GET /participants/search/result

Query Parameter :

- no_pegawai: string, optional
- name : string, name, optional
- email : string, participant email, optional
- phone : string, participant no_telp, optional
- dinas: string, participant dinas, optional,
- bidang: string, participant bidang, optional,
- perusahaan: string, participant perusahaan, optional,
- paging : number, default 1
- size : number, default 10

Headers :

- Authorization : token

Response Body (Success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": [
    {
      "no_pegawai": "12345",
      "name": "John Doe",
      "dinas": "TU",
      "bidang": "TLC-4",
      "perusahaan": "GMF",
      "email": "johndoe@gmail.com",
      "no_telp": "08123456789",
      "Kewarganegaraan": "Indonesia",
      "tempat_lahir": "Jakarta",
      "tanggal_lahir": "2024/01/01",
      "sim_a": "base64",
      "sim_b": "base64",
      "ktp": "base64",
      "foto": "base64",
      "surat_sehat_buta_warna": "base64",
      "exp_surat_sehat": "2024/01/01",
      "surat_bebas_narkoba": "base64",
      "exp_bebas_narkoba": "2024/01/01",
      "gmf_nongmf": "GMF",
      "link_qr_code": "https://example.com",
      "qr_code": "base64",
      "link": {
        "self": "/participants/1",
        "update": "/participants/1",
        "delete": "/participants/1"
      }
    },
    {
      "no_pegawai": "12345",
      "name": "John Doe",
      "dinas": "TU",
      "bidang": "TLC-4",
      "perusahaan": "GMF",
      "email": "johndoe@gmail.com",
      "no_telp": "08123456789",
      "Kewarganegaraan": "Indonesia",
      "tempat_lahir": "Jakarta",
      "tanggal_lahir": "2024/01/01",
      "sim_a": "base64",
      "sim_b": "base64",
      "ktp": "base64",
      "foto": "base64",
      "surat_sehat_buta_warna": "base64",
      "exp_surat_sehat": "2024/01/01",
      "surat_bebas_narkoba": "base64",
      "exp_bebas_narkoba": "2024/01/01",
      "gmf_nongmf": "GMF",
      "link_qr_code": "https://example.com",
      "qr_code": "base64",
      "link": {
        "self": "/participants/1",
        "update": "/participants/1",
        "delete": "/participants/1"
      }
    }
  ],
  "paging": {
    "current_page": 1,
    "total_page": 10,
    "size": 100,
    "links": {
      "next": "/participants/list/result?page=2&size=10",
      "prev": null
    }
  }
}
```

Response Body (Failed) :

```json
{
  "code": "500",
  "status": "SERVER_ERROR",
  "errors": ""
}
```
