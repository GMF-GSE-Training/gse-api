#!/bin/bash

# Test script untuk user search API

BASE_URL="http://localhost:3000"

echo "🔍 Testing User Search API..."
echo "================================"

# Test 1: Search without query (get all users)
echo -e "\n1. Testing GET all users:"
curl -s "${BASE_URL}/users/list/result?page=1&size=5" | jq '.'

# Test 2: Search with query 'LCU'
echo -e "\n2. Testing search with 'LCU':"
curl -s "${BASE_URL}/users/list/result?q=LCU&page=1&size=5" | jq '.'

# Test 3: Search with query 'user'
echo -e "\n3. Testing search with 'user':"
curl -s "${BASE_URL}/users/list/result?q=user&page=1&size=5" | jq '.'

# Test 4: Search with email pattern
echo -e "\n4. Testing search with email pattern 'lcu1':"
curl -s "${BASE_URL}/users/list/result?q=lcu1&page=1&size=5" | jq '.'

# Test 5: Search with dinas pattern
echo -e "\n5. Testing search with dinas 'TC':"
curl -s "${BASE_URL}/users/list/result?q=TC&page=1&size=5" | jq '.'

echo -e "\n✅ User search test completed!"
