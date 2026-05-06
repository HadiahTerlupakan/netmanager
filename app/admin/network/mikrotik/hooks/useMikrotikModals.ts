import { useState } from "react";

/**
 * Custom hook untuk manage modal states (test connection, reconfigure)
 */
export function useMikrotikModals() {
  const [showTestModal, setShowTestModal] = useState(false);
  const [showReconfigureModal, setShowReconfigureModal] = useState(false);

  const openTestModal = () => setShowTestModal(true);
  const closeTestModal = () => setShowTestModal(false);

  const openReconfigureModal = () => setShowReconfigureModal(true);
  const closeReconfigureModal = () => setShowReconfigureModal(false);

  return {
    testModal: {
      isOpen: showTestModal,
      open: openTestModal,
      close: closeTestModal,
    },
    reconfigureModal: {
      isOpen: showReconfigureModal,
      open: openReconfigureModal,
      close: closeReconfigureModal,
    },
  };
}
