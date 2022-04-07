#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the hardhat_node instance that we started (if we started one and if it's still running).
  if [ -n "$hardhat_node_pid" ] && ps -p $hardhat_node_pid > /dev/null; then
    kill -9 $hardhat_node_pid
  fi
}

hardhat_node_port=8545

hardhat_node_running() {
  nc -z localhost "$hardhat_node_port"
}

start_hardhat_node() {
  # We define 13 accounts with balance 1M ether, needed for high-value tests.
  # local accounts=(
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501200,1000000000000000000000000"
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201,1000000000000000000000000"
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501202,1000000000000000000000000"
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501203,1000000000000000000000000"
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501204,1000000000000000000000000"
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501205,1000000000000000000000000"
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501206,1000000000000000000000000"
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501207,1000000000000000000000000"
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501208,1000000000000000000000000"
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501209,1000000000000000000000000"
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501210,1000000000000000000000000"
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501211,1000000000000000000000000"
  #   --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501212,1000000000000000000000000"
  # )

  # # Gas limit of 7,000,000
  # node_modules/.bin/ganache-cli --gasLimit 0x6acfc00 "${accounts[@]}" --port "$ganache_port" > /dev/null &

  npx hardhat  > /dev/null
  hardhat_node_pid=$!
}

if hardhat_node_running; then
  echo "Using existing hardhat_node instance"
else
  echo "Starting our own hardhat_node instance"
  start_hardhat_node
  sleep 1
fi


#npx buidler test
npm run test
