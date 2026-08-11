import { Router, Server, Wifi, Monitor, Shield, HelpCircle } from 'lucide-react'

const ICONS = {
  router:   Router,
  switch:   Monitor,
  server:   Server,
  ap:       Wifi,
  firewall: Shield,
  other:    HelpCircle,
}

/**
 * DeviceTypeIcon — renders a lucide icon for the given device type.
 */
export default function DeviceTypeIcon({ type, size = 18, className = '' }) {
  const Icon = ICONS[type] ?? HelpCircle
  return <Icon size={size} className={className} />
}
