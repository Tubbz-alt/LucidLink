package com.resmed.refresh.ui.uibase.base;

import android.os.Bundle;

import com.resmed.refresh.bluetooth.CONNECTION_STATE;
import com.resmed.refresh.model.json.JsonRPC;

public abstract interface BluetoothDataListener {
	public abstract void handleBreathingRate(Bundle paramBundle);

	public abstract void handleConnectionStatus(CONNECTION_STATE paramCONNECTION_STATE);

	public abstract void handleEnvSample(Bundle paramBundle);

	public abstract void handleReceivedRpc(JsonRPC paramJsonRPC);

	public abstract void handleSleepSessionStopped(Bundle paramBundle);

	public abstract void handleStreamPacket(Bundle paramBundle);

	public abstract void handleUserSleepState(Bundle paramBundle);
}