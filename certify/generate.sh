#!/usr/bin/env bash

# Make sure this script is run as root
if [ "$EUID" -ne 0 ] ; then
        echo "Please run as root. Try again by typing: sudo !!"
    exit
fi

function command_exists () {
    type "$1" &> /dev/null ;
}

# Make sure openssl exists
if ! command_exists openssl ; then
        echo "OpenSSL isn't installed. You need that to generate SSL certificates."
    exit
fi

name="servor"

## Make sure the tmp/ directory exists
if [ ! -d "tmp" ]; then
    mkdir tmp/
fi

# Cleanup files from previous runs
rm ../*.crt ../*.key

# Remove any lines that start with CN
sed -i '' '/^CN/ d' ca-options.conf
# Modify the conf file to set CN = ${name}
echo "CN = ${name}" >> ca-options.conf

# Generate Certificate Authority
openssl genrsa -out "tmp/${name}CA.key" 2048 &>/dev/null
openssl req -x509 -config ca-options.conf -new -nodes -key "tmp/${name}CA.key" -sha256 -days 1825 -out "../${name}CA.pem" &>/dev/null

if command_exists security ; then
    # Delete trusted certs by their common name via https://unix.stackexchange.com/a/227014
    security find-certificate -c "${name}" -a -Z | sudo awk '/SHA-1/{system("security delete-certificate -Z "$NF)}'
    # Trust the Root Certificate cert
    security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "../${name}CA.pem"
fi

# Generate CA-signed Certificate
openssl genrsa -out "../${name}.key" 2048 &>/dev/null
openssl req -new -config ca-options.conf -key "../${name}.key" -out "tmp/${name}.csr" &>/dev/null

# Generate SSL Certificate
openssl x509 -req -in "tmp/${name}.csr" -CA "../${name}CA.pem" -CAkey "tmp/${name}CA.key" -CAcreateserial -out "../${name}.crt" -days 1825 -sha256 -extfile options.conf &>/dev/null

# Cleanup a stray file
rm .srl
rm -rf tmp
rm ../servorCA.pem

# The username behind sudo, to give ownership back
user=$( who am i | awk '{ print $1 }')
chown -R "$user" ..

# echo "All done!"
