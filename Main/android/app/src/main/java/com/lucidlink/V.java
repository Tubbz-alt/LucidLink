package com.lucidlink;

import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;

import com.choosemuse.libmuse.LibmuseVersion;

import java.io.File;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.util.ArrayList;
import java.util.List;

public class V {
	public static void Log(String message) {
		Log.i("default", message);
	}
	public static void Log(String tag, String message) {
		Log.i(tag, message);
	}

	public static void Toast(String message) {
		Main.main.ShowToast(message, 3);
	}
	public static void Toast(String message, int duration) {
		Main.main.ShowToast(message, duration);
	}

	public static ViewGroup GetRootView() {
		return (ViewGroup)MainActivity.main.getWindow().getDecorView().getRootView();
	}
	public static LinearLayout GetRootLinearLayout() {
		return (LinearLayout)((ViewGroup)MainActivity.main.getWindow().getDecorView().getRootView()).getChildAt(0);
	}

	/*public static ArrayList<View> FindDescendants(View v) {
		ArrayList<View> visited = new ArrayList<View>();
		ArrayList<View> unvisited = new ArrayList<View>();
		unvisited.add(v);

		while (!unvisited.isEmpty()) {
			View child = unvisited.remove(0);
			visited.add(child);
			if (!(child instanceof ViewGroup)) continue;
			ViewGroup group = (ViewGroup) child;
			final int childCount = group.getChildCount();
			for (int i=0; i<childCount; i++)
				unvisited.add(group.getChildAt(i));
		}

		return visited;
	}*/

	public static View FindViewByContentDescription(View root, String contentDescription) {
		List<View> visited = new ArrayList<View>();
		List<View> unvisited = new ArrayList<View>();
		unvisited.add(root);

		V.Log("Starting...");
		while (!unvisited.isEmpty()) {
			View child = unvisited.remove(0);
			visited.add(child);

			V.Log("Content description: " + child.getContentDescription());
			if (child.getContentDescription() != null && child.getContentDescription().toString().equals(contentDescription))
				return child;

			if (!(child instanceof ViewGroup)) continue;
			ViewGroup group = (ViewGroup) child;
			final int childCount = group.getChildCount();
			for (int i=0; i<childCount; i++)
				unvisited.add(group.getChildAt(i));
		}

		//return visited;
		return null;
	}
}

class VFile {
	public static String ReadAllText(File file) {
		try {
			FileInputStream stream = new FileInputStream(file);
			StringBuilder result = new StringBuilder(512);
			Reader r = new InputStreamReader(stream, "UTF-8");
			int c;
			while ((c = r.read()) != -1) {
				result.append((char) c);
			}
			return result.toString();
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}
}