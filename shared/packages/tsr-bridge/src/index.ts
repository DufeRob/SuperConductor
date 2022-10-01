import { BridgeAPI, LoggerLike } from '@shared/api'
import { assertNever } from '@shared/lib'
import { ResourceAny } from '@shared/models'
import { PeripheralsHandler } from '@shared/peripherals'
import { Mappings, TSRTimeline } from 'timeline-state-resolver-types'
import { TSR } from './TSR'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: CURRENT_VERSION }: { version: string } = require('../package.json')

export class BaseBridge {
	peripheralsHandler: PeripheralsHandler | null = null
	private myBridgeId: string | null = null
	private tsr: TSR
	private storedTimelines: {
		[id: string]: TSRTimeline
	} = {}
	private mappings: Mappings | undefined = undefined
	private peripheralsHandlerSend: (message: BridgeAPI.FromBridge.Any) => void | null = () => null
	private sendAndCatch: (msg: BridgeAPI.FromBridge.Any) => void

	constructor(private send: (msg: BridgeAPI.FromBridge.Any) => void, private log: LoggerLike) {
		this.tsr = new TSR(log)
		this.sendAndCatch = (msg: BridgeAPI.FromBridge.Any) => {
			try {
				send(msg)
			} catch (e) {
				log?.error(e)
			}
		}
		this.tsr.send = this.sendAndCatch
	}

	private setupPeripheralsHandler(bridgeId: string): PeripheralsHandler {
		const peripheralsHandler = new PeripheralsHandler(this.log, bridgeId)

		peripheralsHandler.on('connected', (deviceId, info) => {
			this.peripheralsHandlerSend({ type: 'PeripheralStatus', deviceId, info, status: 'connected' })
			this.peripheralsHandlerSend({
				type: 'AvailablePeripherals',
				peripherals: peripheralsHandler.getAvailablePeripherals(),
			})
		})
		peripheralsHandler.on('disconnected', (deviceId, info) => {
			this.peripheralsHandlerSend({ type: 'PeripheralStatus', deviceId, info, status: 'disconnected' })
			this.peripheralsHandlerSend({
				type: 'AvailablePeripherals',
				peripherals: peripheralsHandler.getAvailablePeripherals(),
			})
		})
		peripheralsHandler.on('keyDown', (deviceId, identifier) => {
			this.peripheralsHandlerSend({ type: 'PeripheralTrigger', trigger: 'keyDown', deviceId, identifier })
		})
		peripheralsHandler.on('keyUp', (deviceId, identifier) => {
			this.peripheralsHandlerSend({ type: 'PeripheralTrigger', trigger: 'keyUp', deviceId, identifier })
		})
		peripheralsHandler.on('availablePeripherals', (peripherals) => {
			this.peripheralsHandlerSend({ type: 'AvailablePeripherals', peripherals })
		})

		peripheralsHandler.init()

		// Initial status

		return peripheralsHandler
	}

	private playTimeline(id: string, newTimeline: TSRTimeline, currentTime: number) {
		this.storedTimelines[id] = newTimeline

		this.updateTSR(currentTime)
		return Date.now()
	}

	private stopTimeline(id: string, currentTime: number) {
		delete this.storedTimelines[id]
		this.updateTSR(currentTime)
	}

	private updateTSR(currentTime: number) {
		this.tsr.setCurrentTime(currentTime)

		const fullTimeline: TSRTimeline = []

		for (const timeline of Object.values(this.storedTimelines)) {
			for (const obj of timeline) {
				fullTimeline.push(obj)
			}
		}
		// log.info('fullTimeline', JSON.stringify(fullTimeline, undefined, 2))
		// log.info('mapping', JSON.stringify(mapping, undefined, 2))

		this.tsr.conductor.setTimelineAndMappings(fullTimeline, this.mappings)
	}

	private updateMappings(newMappings: Mappings, currentTime: number) {
		this.mappings = newMappings
		this.updateTSR(currentTime)
	}
	/** To be called when our bridgeId has been determined. This is basivally the initialize function */
	async onReceivedBridgeId(bridgeId: string) {
		if (this.myBridgeId !== bridgeId) {
			this.myBridgeId = bridgeId

			if (this.peripheralsHandler) {
				try {
					await this.peripheralsHandler.close()
				} catch (e) {
					this.log?.error(e)
				}
				this.peripheralsHandler = null
			}
		}
		try {
			if (!this.peripheralsHandler) {
				this.peripheralsHandler = this.setupPeripheralsHandler(this.myBridgeId)
			}

			this.peripheralsHandlerSend = this.sendAndCatch
			await this.peripheralsHandler.setConnectedToParent(true)

			this.tsr.reportAllStatuses()
		} catch (e) {
			this.log?.error(e)
		}
	}

	handleMessage(msg: BridgeAPI.FromSuperConductor.Any) {
		if (msg.type === 'setId') {
			this.onReceivedBridgeId(msg.id)
				// Wait until after the initialization of things like the peripherals handler
				// before telling SuperConductor that the bridge is ready.
				.then(() => this.send({ type: 'init', id: msg.id, version: CURRENT_VERSION, incoming: false }))
				.catch((e) => this.log?.error(e))
		} else if (msg.type === 'addTimeline') {
			this.playTimeline(msg.timelineId, msg.timeline, msg.currentTime)
		} else if (msg.type === 'removeTimeline') {
			this.stopTimeline(msg.timelineId, msg.currentTime)
		} else if (msg.type === 'getTimelineIds') {
			this.send({ type: 'timelineIds', timelineIds: Object.keys(this.storedTimelines) })
		} else if (msg.type === 'setMappings') {
			this.updateMappings(msg.mappings, msg.currentTime)
		} else if (msg.type === 'setSettings') {
			if (!this.peripheralsHandler) throw new Error('PeripheralsHandler not initialized')

			this.tsr.updateDevices(msg.devices).catch((e) => this.log?.error(e))
			this.peripheralsHandler
				.updatePeripheralsSettings(msg.peripherals, msg.autoConnectToAllPeripherals)
				.catch((e) => this.log?.error(e))
		} else if (msg.type === 'refreshResources') {
			this.tsr.refreshResources((deviceId: string, resources: ResourceAny[]) => {
				this.send({
					type: 'updatedResources',
					deviceId,
					resources,
				})
			})
		} else if (msg.type === 'peripheralSetKeyDisplay') {
			if (!this.peripheralsHandler) throw new Error('PeripheralsHandler not initialized')

			this.peripheralsHandler.setKeyDisplay(msg.deviceId, msg.identifier, msg.keyDisplay)
		} else if (msg.type === 'getAvailablePeripherals') {
			if (!this.peripheralsHandler) throw new Error('PeripheralsHandler not initialized')

			this.send({ type: 'AvailablePeripherals', peripherals: this.peripheralsHandler.getAvailablePeripherals() })
		} else {
			assertNever(msg)
		}
	}

	async destroy() {
		if (this.peripheralsHandler) {
			await this.peripheralsHandler.close()
			this.peripheralsHandler = null
		}
	}
}
