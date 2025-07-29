#!/bin/bash

echo "Testing Capability Search API..."
echo "================================="

# Test 1: Search dengan kata "Tractor" (ada di data)
echo "1. Testing dengan kata 'tractor':"
curl -s -X GET 'http://localhost:3000/capability/list/result?q=tractor&page=1' \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=test" | jq '.' || echo "Failed"

echo -e "\n2. Testing dengan kata 'BTT':"
curl -s -X GET 'http://localhost:3000/capability/list/result?q=BTT&page=1' \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=test" | jq '.' || echo "Failed"

echo -e "\n3. Testing dengan kata 'cargo' (tidak ada di data):"
curl -s -X GET 'http://localhost:3000/capability/list/result?q=cargo&page=1' \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=test" | jq '.' || echo "Failed"

echo -e "\n4. Testing tanpa search (all data):"
curl -s -X GET 'http://localhost:3000/capability/list/result?page=1' \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=test" | jq '.' || echo "Failed"

echo -e "\nTest completed."
