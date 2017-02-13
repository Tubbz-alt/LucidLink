package com.resmed.refresh.bluetooth.receivers;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.resmed.refresh.utils.RefreshBluetoothManager;

public class BluetoothDeviceFoundReceiver
		extends BroadcastReceiver {
	private RefreshBluetoothManager bluetoothManager;

	public BluetoothDeviceFoundReceiver(RefreshBluetoothManager paramRefreshBluetoothManager) {
		this.bluetoothManager = paramRefreshBluetoothManager;
	}

	public void onReceive(Context paramContext, Intent paramIntent) {
	}
}