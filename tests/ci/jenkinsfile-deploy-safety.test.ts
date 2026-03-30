import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readJenkinsfile(): string {
  return readFileSync(resolve(process.cwd(), 'Jenkinsfile'), 'utf8')
}

describe('Jenkinsfile deploy safety', () => {
  it('applies namespace explicitly before migration infra resources', () => {
    const jenkinsfile = readJenkinsfile()

    const namespaceIndex = jenkinsfile.indexOf('kubectl apply -f ${K8S_DIR}/namespace.yaml')
    const configMapIndex = jenkinsfile.indexOf('kubectl apply -f ${K8S_DIR}/configmap.yaml --namespace=${NAMESPACE}')
    const dbIndex = jenkinsfile.indexOf('kubectl apply -f ${K8S_DIR}/db-statefulset.yaml --namespace=${NAMESPACE}')

    expect(namespaceIndex).toBeGreaterThanOrEqual(0)
    expect(configMapIndex).toBeGreaterThan(namespaceIndex)
    expect(dbIndex).toBeGreaterThan(namespaceIndex)
    expect(jenkinsfile).not.toContain('configmap.yaml --namespace=${NAMESPACE} || true')
    expect(jenkinsfile).not.toContain('db-statefulset.yaml --namespace=${NAMESPACE} || true')
    expect(jenkinsfile).not.toContain('redis-deployment.yaml --namespace=${NAMESPACE} || true')
    expect(jenkinsfile).not.toContain('pvc.yaml --namespace=${NAMESPACE} || true')
  })

  it('uses deterministic manifest apply loop instead of find-xargs apply', () => {
    const jenkinsfile = readJenkinsfile()

    expect(jenkinsfile).toContain('find ${K8S_DIR}/ -maxdepth 1 -name "*.yaml" ! -name "secrets.yaml" ! -name "namespace.yaml" | sort | while IFS= read -r manifest; do')
    expect(jenkinsfile).not.toContain('find ${K8S_DIR}/ -name "*.yaml" ! -name "secrets.yaml" | xargs -I {} kubectl apply -f {} --namespace=${NAMESPACE}')
  })

  it('restarts and verifies cron rollout after applying static-tag staging manifests', () => {
    const jenkinsfile = readJenkinsfile()

    expect(jenkinsfile).toContain('kubectl rollout restart deployment/netmanager-cron --namespace=${NAMESPACE}')
    expect(jenkinsfile).toContain('kubectl rollout status deployment/netmanager-cron --namespace=${NAMESPACE} --timeout=300s')
  })

  it('does not tolerate radius rollout restart or status failures', () => {
    const jenkinsfile = readJenkinsfile()

    expect(jenkinsfile).toContain('kubectl rollout restart deployment/netmanager-radius --namespace=${NAMESPACE}')
    expect(jenkinsfile).toContain('kubectl rollout status deployment/netmanager-radius --namespace=${NAMESPACE} --timeout=300s')
    expect(jenkinsfile).not.toContain('kubectl rollout restart deployment/netmanager-radius --namespace=${NAMESPACE} || true')
    expect(jenkinsfile).not.toContain('kubectl rollout status deployment/netmanager-radius --namespace=${NAMESPACE} --timeout=300s || true')
  })
})
