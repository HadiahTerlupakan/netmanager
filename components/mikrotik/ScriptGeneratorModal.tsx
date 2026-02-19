"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { HiClipboard, HiClipboardDocumentCheck } from 'react-icons/hi2'

type ScriptGeneratorModalProps = {
  open: boolean
  onClose: () => void
  secret: string
}

export default function ScriptGeneratorModal({ open, onClose, secret }: ScriptGeneratorModalProps) {
  const [serverIp, setServerIp] = useState('')
  const [copied, setCopied] = useState(false)

  if (!open) return null

  // Script teplate
  const scriptHost = `/radius add address=${serverIp || '<IP_APLIKASI_INI>'} secret=${secret || '<SECRET_RADIUS>'} service=ppp,login,hotspot timeout=3000ms comment="added by netmanager"`
  const scriptIncoming = `/radius incoming set accept=yes port=3799`

  const fullScript = `${scriptHost}\n${scriptIncoming}`

  const handleCopy = () => {
    navigator.clipboard.writeText(fullScript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="MikroTik Script Generator"
      size="2xl"
    >
      <div className="p-6 space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Script ini digunakan untuk menghubungkan MikroTik ke aplikasi NetManager (RADIUS).
            Silakan copy dan paste script ini ke terminal MikroTik Anda.
          </p>
        </div>

        {/* Input Server IP */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            IP Address Aplikasi (NetManager)
          </label>
          <input
            type="text"
            value={serverIp}
            onChange={(e) => setServerIp(e.target.value)}
            placeholder="Contoh: 103.1.1.1 atau 192.168.1.50"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Masukkan IP Public atau Private dimana aplikasi ini diinstall, yang bisa diakses oleh MikroTik.
          </p>
        </div>

        {/* Script Output */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Generated Script
          </label>
          <div className="relative">
            <pre className="w-full p-4 bg-gray-900 text-green-400 font-mono text-sm rounded-lg overflow-x-auto whitespace-pre-wrap">
              {fullScript}
            </pre>
            <Button
              onClick={handleCopy}
               className="absolute top-2 right-2"
              title="Copy to Clipboard"
            >
              {copied ? <HiClipboardDocumentCheck className="w-5 h-5 text-green-400" /> : <HiClipboard className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        <ModalFooter>
          <Button variant="secondary"
            onClick={onClose}
            
          >
            Tutup
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
