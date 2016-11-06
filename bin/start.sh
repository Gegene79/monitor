#!/bin/bash
printf '\n*** Lancement node.js ***\n\n' 
env_file=./node.env
printf 'Fichier environment: %s\n' "$env_file"
while IFS= read -r line; do
    printf '%s\n' "$line"
    export "$line"
done < "$env_file"
printf '\n'
./www