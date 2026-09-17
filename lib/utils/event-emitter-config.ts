import { EventEmitter } from "events";

// Set max listeners secara global untuk menghindari warning
// Library net-snmp menggunakan EventEmitter (Commander)
// yang dapat menambahkan banyak listener
if (typeof EventEmitter !== "undefined" && EventEmitter.defaultMaxListeners) {
  EventEmitter.defaultMaxListeners = 20;
}

// Export untuk digunakan di tempat lain jika diperlukan
export function setMaxListenersForEmitter(
  emitter: EventEmitter,
  max: number = 20,
) {
  if (emitter && typeof emitter.setMaxListeners === "function") {
    emitter.setMaxListeners(max);
  }
}
