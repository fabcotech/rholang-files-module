## Rholang files module

![Mountains with fog](https://images.pexels.com/photos/167699/pexels-photo-167699.jpeg?auto=compress&cs=tinysrgb&dpr=0.5&h=750&w=1260)

```
# Input values in .env file

# Initiate module (will issue blockchain transaction)
node deploy_file_module.js --private-key aaa

# Add a file (will issue blockchain transaction)
node add_file --file ./README.MD --private-key aaa --registry-uri bbb
```

File module to manage files on the blockchain. Basically it can be anything other than files, the contract creates a map on chain, this map has write access provided to only one identity (private key).

The address system for such a system is based first on the registry URI, and then on an arbitrary file id/name. Some address examples :

registry_uri.file_id_or_name

3gsz44jg3dowfqoq8y5ap33u891yrw7bjdmrtnnhnrhzitwcfa4a9o.166efceb071746d589d5ed4a90213ec6
3gsz44jg3dowfqoq8y5ap33u891yrw7bjdmrtnnhnrhzitwcfa4a9o.e8becb4e6469f19defb7c75105828959
3gsz44jg3dowfqoq8y5ap33u891yrw7bjdmrtnnhnrhzitwcfa4a9o.monster
3gsz44jg3dowfqoq8y5ap33u891yrw7bjdmrtnnhnrhzitwcfa4a9o.important_document

#### Files on chain

Files are represented as a gzipped ans base64 string of the following object (see add_file.js:112)

```
{
  mimeType: mimeType, // string ex: application/json
  name: name, // string ex: package.json
  data: data, // string base64(fs.readFileSync())
  signature: signature, // string, generated by the private key used to sign the deploy
}
```

#### Files module

The file module in rholang has the following structure :

```
{
  "entryRegistryUri": "uri_for_add_or_update",
  "filesRegistryUri": "uri_for_read",
  "publicKey": "bbbababacda454545349090990",
  "nonce": "abcdff45f45f45aaaa56cdaaa",
  "files": {
    "0001" : Unforgeable(0x995464b16b0fdfffc1e5c10684aedd57e4ecf7b49473059c50f17624e5b25776),
    "0002" : Unforgeable(0x4a60ee07be7b0eb2c8af7f47ed5a8176b5f99ba00f9700725c5331a8b10705ae),
    "monster" : Unforgeable(0x03d61e567d30e369167ab1a432b3a4fc02aec730f739fa0143ef70ba4d2d80ac)
  },
  "version": "0.1"
}
```

The nonce is changed each time there is an operation on the file module. A signature provided in the payload is checked each time an operation on the file module is done (add/update).