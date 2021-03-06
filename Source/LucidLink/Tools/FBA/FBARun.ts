import {TimerContext, Sequence, Timer} from "../../../Frame/General/Timers";
import {AudioFileManager, AudioFile} from "../../../Frame/AudioFile";
import {SleepStage} from "../../../Frame/SPBridge";
import Moment from "moment";
import {LL} from "../../../LucidLink";
import {JavaBridge} from "../../../Frame/Globals";
import SPBridge from "../../../Frame/SPBridge";
import {PlayAudioFile, Wait, Action, RepeatSteps} from "../@Shared/Action";
import {Log} from "../../../Packages/VDF/VDF";
import { WaitXThenDo, Speak, audioFileManager } from "../../Scripts/ScriptGlobals";

export class ListenersContext {
	listEntries = [] as {list, entry}[];
	AddListEntry(list, entry) {
		list.push(entry);
		this.listEntries.push({list, entry});
	}
	Reset() {
		for (let {list, entry} of this.listEntries) {
			list.Remove(entry);
		}
		this.listEntries.Clear();
	}
}

export default class FBARun {
	timerContext = new TimerContext();
	listenersContext = new ListenersContext();
	audioFileManager = new AudioFileManager();
	
	remSequence: Sequence;
	StopREMSequence() {
		if (this.remSequence) { //&& this.remSequence.Active) {
			this.remSequence.Stop();
			this.remSequence = null;
		}
	}
	
	currentSegment_stage = null as SleepStage;
	currentSegment_startTime: Moment.Moment = null;
	Start() {
		let node = LL.tools.fba;
		JavaBridge.Main.SetVolumes(node.normalVolume, node.bluetoothVolume); // set at start as well, for convenience
		this.StartBackgroundMusic();
		this.StartREMStartListener();
		this.StartCommandListener();
		this.StartRestartManager();
		this.StartStatusReporter();
		LL.tracker.currentSession.StartSleepSession();

		if (g.FBA_PostStart) g.FBA_PostStart();
	}

	StartBackgroundMusic() {
		let node = LL.tools.fba;
		if (node.backgroundMusic_enabled) {
			for (let track of node.backgroundMusic_tracks) {
				var audioFile = this.audioFileManager.GetAudioFile(track);
				audioFile.PlayCount = -1;
				//audioFile.Stop().SetVolume(0);
				audioFile.Play({delay: 0}).SetVolume(node.backgroundMusic_volume);
			}
			new Timer(30, ()=> {
				for (let track of node.backgroundMusic_tracks) {
					var audioFile = this.audioFileManager.GetAudioFile(track);
					audioFile.Play({delay: 0}).SetVolume(node.backgroundMusic_volume);
				}
			}).Start().SetContext(this.timerContext);
		}
	}

	remSequenceEnabledAt = 0;
	get REMSequenceEnabled() { return Date.now() >= this.remSequenceEnabledAt; }
	StartREMStartListener() {
		let node = LL.tools.fba;
		this.remSequenceEnabledAt = 0;
		this.listenersContext.AddListEntry(SPBridge.listeners_onReceiveSleepStage, (stage: SleepStage)=> {
			if (!this.REMSequenceEnabled) return;

			if (stage != this.currentSegment_stage) {
				this.currentSegment_stage = stage as SleepStage;
				this.currentSegment_startTime = Moment();
				//Log("New sleep stage: " + stage)
				this.StopREMSequence();
				this.triggeredForThisSegment = false;
			}

			var timeInSegment = Moment().diff(this.currentSegment_startTime, "minutes", true);
			let promptStartDelay_final = node.promptStartDelay + (20 / 60); // add 20s, so we don't clash with status-monitor speech
			if (stage == SleepStage.V.Rem && timeInSegment >= promptStartDelay_final && !this.triggeredForThisSegment) {
				this.triggeredForThisSegment = true;
				this.StartREMSequence();
			}
		});
	}
	StartREMSequence() {
		let node = LL.tools.fba;

		this.remSequence = new Sequence().SetContext(this.timerContext);
		/*for (var i = 0; i <= 100; i++) {
			this.remSequence.AddSegment(node.promptInterval * 60, ()=>this.RunActions());
		}*/
		AddActionsToREMSequence({audioFileManager: this.audioFileManager}, this.remSequence, node.promptActions, node.promptActions);
		this.remSequence.Start();
	};

	static SAMPLES_PER_SECOND = 16;
	static BREATH_VALUES_PER_15S = FBARun.SAMPLES_PER_SECOND * 15; // base breath-value average on the last 15-seconds
	static BREATH_VALUES_PER_30S = FBARun.SAMPLES_PER_SECOND * 30; // store data from the last 30-seconds

	bufferCount = 0;
	lastPromptTime = 0;
	StartCommandListener() {
		let node = LL.tools.fba;
		let monitor = LL.tools.spMonitor.monitor;
		this.listenersContext.AddListEntry(SPBridge.listeners_onReceiveBreathingDepth, (depth_prev: number, depth_last: number)=> {
			this.bufferCount++;
			if (this.bufferCount < FBARun.BREATH_VALUES_PER_30S) return;

			let percentDiff = (monitor.breathingDepth_last / monitor.breathingDepth_prev).Distance(1);
			if (percentDiff >= node.commandListener.sequenceDisabler_minPercentDiff) {
				//let wasEnabled = this.REMSequenceEnabled;
				this.StopREMSequence();
				this.triggeredForThisSegment = false; // allow sequence to restart, during this same segment (it might be long)
				this.remSequenceEnabledAt = Date.now() + (node.commandListener.sequenceDisabler_disableLength * 60 * 1000);

				let timeSinceLastPromptMS = Date.now() - this.lastPromptTime;
				if (timeSinceLastPromptMS >= node.commandListener.sequenceDisabler_promptMinInterval * 60 * 1000) {
					this.lastPromptTime = Date.now();
					node.commandListener.sequenceDisabler_messageSpeakAction.Run();
				}
			}
		});
	}
	StartRestartManager() {
		let lastBreathValueReceiveTime = Date.now();
		this.listenersContext.AddListEntry(SPBridge.listeners_onReceiveBreathValues, (breathValue1: number, breathValue2: number)=> {
			lastBreathValueReceiveTime = Date.now();
		});
		new Timer(10, ()=> {
			// if it's been more than 10 seconds since the last breath-value receive, restart S+ data stream
			let timeSince = Date.now() - lastBreathValueReceiveTime;
			if (timeSince > 10000) {
				Log(`It's been ${Math.round(timeSince / 1000)} seconds since the last breath-value was received, so restarting S+ data stream...`);
				/*SPBridge.StopSession();
				WaitXThenDo(1, ()=> {
					SPBridge.StartSleepSession();
				});*/
				SPBridge.RestartDataStream();
			}
		}).Start().SetContext(this.timerContext);
	}
	StartStatusReporter() {
		let node = LL.tools.fba;
		if (node.statusReporter.reportInterval == 0) return;
		new Timer(node.statusReporter.reportInterval * 60, ()=> {
			let finalMessage = node.statusReporter.reportText;
			finalMessage = ReplaceVariablesInReportText(finalMessage);
			Speak({text: finalMessage, volume: node.statusReporter.volume, pitch: node.statusReporter.pitch});
		}).Start().SetContext(this.timerContext);
	}

	triggeredForThisSegment = false;

	Stop() {
		this.StopREMSequence();
		this.timerContext.Reset();
		this.listenersContext.Reset();
		this.audioFileManager.Reset();
		LL.tracker.currentSession.CurrentSleepSession.End();
		this.bufferCount = 0;
		if (g.FBA_PostStop) g.FBA_PostStop();
	}
}

interface Context {
	audioFileManager: AudioFileManager;
}
function AddActionsToREMSequence(context: Context, sequence: Sequence, originalActions: Action[], newActions: Action[], asRepeat = false) {
	for (let action of newActions) {
		if (action instanceof Wait) {
			sequence.AddSegment(action.waitTime * 60, ()=>{}, ` @type:${action.constructor.name}`);
		} else if (action instanceof RepeatSteps) {
			if (!asRepeat) { // don't apply a RepeatSteps meta-action, if we're already within the application of an earlier RepeatSteps
				let actionsToRepeat = originalActions.slice(action.firstStep - 1, (action.lastStep - 1) + 1);
				for (let i = 0; i < action.repeatCount; i++) {
					AddActionsToREMSequence(context, sequence, originalActions, actionsToRepeat, true);
				}
			}
		} else if (action instanceof PlayAudioFile) {
			sequence.AddSegment(0, ()=>action.Run(context.audioFileManager), ` @type:${action.constructor.name}`);
		} else {
			sequence.AddSegment(0, ()=>action.Run(), ` @type:${action.constructor.name}`);
		}
	}
}

function ReplaceVariablesInReportText(text: string) {
	let result = text;

	let node = LL.tools.fba;
	let monitor = LL.tools.spMonitor.monitor;
	result = result
		.replace(/@temp/g, ()=>monitor.temp.toFixed())
		.replace(/@light/g, ()=>monitor.light.toFixed())
		.replace(/@breathVal/g, ()=>monitor.breathVal.x.toFixed())
		.replace(/@breathVal_min/g, ()=>monitor.breathVal_min.x.toFixed())
		.replace(/@breathVal_max/g, ()=>monitor.breathVal_max.x.toFixed())
		.replace(/@breathVal_avg/g, ()=>monitor.breathVal_avg.x.toFixed())
		.replace(/@breathingDepth_prev/g, ()=>monitor.breathingDepth_prev.toFixed())
		.replace(/@breathingDepth_last/g, ()=>monitor.breathingDepth_last.toFixed())
		.replace(/@breathingRate/g, ()=>monitor.breathingRate.toFixed())
		.replace(/@sleepStage/g, ()=>SleepStage[monitor.sleepStage as any as number])
		/*.replace(/@sleepStageTime/g, ()=>monitor.sleepStageTime+"")
		.replace(/@remSequenceEnabled/g, ()=>monitor.remSequenceEnabled+"")*/
		
	
	return result;
}