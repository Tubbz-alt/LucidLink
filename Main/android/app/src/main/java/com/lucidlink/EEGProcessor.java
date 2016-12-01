package com.lucidlink;

import com.annimon.stream.Stream;
import com.lucidlink.Frame.Pattern;
import com.lucidlink.Frame.Vector2i;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;

class EEGProcessor {
	public EEGProcessor(ChartManager chartManager) {
		this.chartManager = chartManager;
	}
	ChartManager chartManager;

	// for the moment, assume X packets per second (get the actual number at some point)
	public final int packetsPerSecond = 20;

	// general
	// ==========

	// where eg. [0][1] (channel, x-pos/index) is {x:1,y:9} (x-pos, y-pos)
	List<Vector2i[]> channelPoints = new ArrayList<>();
	int[] channelBaselines = new int[4];

	HashMap<String, HashMap<Integer, Double>> patternMatchProbabilities = new HashMap<>();
	int lastX = -1;
	int maxX = 1000;

	public void OnReceiveMuseDataPacket(String type, ArrayList<Double> column) {
		if (!type.equals("eeg")) return;

		int currentX = lastX + 1;
		if (currentX > maxX)
			currentX = 0;

		//for (var channel = 0; channel < 6; channel++)
		for (int channel = 0; channel < 4; channel++) {
			if (channelPoints.size() <= channel) {
				channelPoints.add(new Vector2i[maxX + 1]);
				for (int x = 0; x <= maxX; x++)
					channelPoints.get(channel)[x] = new Vector2i(x, 0);
			}
			Vector2i point = new Vector2i(currentX, (int)(double)column.get(channel));
			channelPoints.get(channel)[currentX] = point;
		}

		lastX = currentX;
		//Log("muse link", `Type: ${type} Data: ${ToJSON(data)}`);

		// only update the baseline once every chart-width
		if (currentX == maxX) {
			for (int channel = 0; channel < 4; channel++)
				channelBaselines[channel] = GetChannelBaseline(channel);
		}

		int patternMatchInterval_inPackets = (int)(Main.main.patternMatchInterval * packetsPerSecond);
		int scanOffset_inPackets = (int)(Main.main.patternMatchOffset * packetsPerSecond);
		if (currentX % patternMatchInterval_inPackets == 0 && Main.main.patternMatch) {
			for (Pattern pattern : Main.main.patterns) {
				if (!pattern.channel1 && !pattern.channel2 && !pattern.channel3 && !pattern.channel4) continue;
				V.Assert(pattern.points.size() >= 2, "Pattern point count too low. Should be 2+, not " + pattern.points.size() + ".");

				int patternDuration = pattern.Duration();
				double highestMatchProb = Integer.MIN_VALUE;
				for (int scanRight = currentX; scanRight >= currentX - patternMatchInterval_inPackets; scanRight -= scanOffset_inPackets) {
					int scanLeft = scanRight - patternDuration;
					//var patternPoints_final = ConvertPoints(pattern.points);

					for (int channel = 0; channel < 4; channel++) {
						if (!pattern.IsChannelEnabled(channel)) continue;

						List<Vector2i> points = GetPointsForScanRange(channel, scanLeft, scanRight);
						V.Assert(points != null && points.size() >= 2, "Scanned point count too low. Should be 2+, not " + (points != null ? points.size() : "n/a") + ".");
						//let channelPoints_final = ConvertPoints(points);

						//int channelBaseline = GetChannelBaseline(channel);
						int channelBaseline = channelBaselines[channel];

						/*let channelPoints_final = CenterOnY(points, channelBaseline);
						channelPoints_final = TrimXValuesTo(channelPoints_final, scanLeft);*/
						new Vector2i(0, 0).NewX(a->a);
						//List<Vector2i> channelPoints_final = V.List(Stream.of(points).map(a->a.NewX(x->x - scanLeft).NewY(y->y - channelBaseline)));
						List<Vector2i> channelPoints_final = new ArrayList<>();
						for (int i = 0, x = scanLeft; x < scanRight; i++, x++) {
							boolean takenFromEnd = x < 0;
							Vector2i point = points.get(i);
							Vector2i point_final = new Vector2i(point.x - scanLeft, point.y - channelBaseline);
							if (takenFromEnd)
								point_final.x -= (maxX + 1);
							channelPoints_final.add(point_final);
						}

						/*final int yValRange = 100; // estimate of max positive-value (from base-line)
						double maxDistancePossible = new Vector2i(scanLeft, -yValRange).Distance(new Vector2i(scanRight, yValRange));*/
						//double maxDistancePossible = 100;
						double probability0Distance = pattern.sensitivity;

						//let matchProb = Sketchy.shapeContextMatch(channelPoints_final, patternPoints_final);
						//let distance = Sketchy.hausdorff(channelPoints_final, patternPoints_final, {x: 0, y: 0});
						double distance = GetAverageOfPointClosestDistances(pattern.points, channelPoints_final);

						double matchProb = 1 - (distance / probability0Distance);
						matchProb = Math.max(0, matchProb); // maybe temp

						V.Log("pattern-matching", channelBaseline + " | " + distance + " | " + probability0Distance + " | " + matchProb, false);
/*PatternPoints: ${ToVDF(pattern.points, false)}
ChannelPoints: ${ToVDF(points, false)}
ChannelPoints_Final: ${ToVDF(channelPoints_final, false)}`);*/
						highestMatchProb = Math.max(highestMatchProb, matchProb);
					}
				}
				//patternMatchProbabilities[pattern.name] = highestMatchProb;
				if (!patternMatchProbabilities.containsKey(pattern.name))
					patternMatchProbabilities.put(pattern.name, new HashMap<>());
				patternMatchProbabilities.get(pattern.name).put(currentX, highestMatchProb);
				//Log(`Setting pattern match prob. Match: ${pattern.name} Prob: ${highestMatchProb}`);
				//JavaLog(`Setting pattern match prob. Match: ${pattern.name} Prob: ${highestMatchProb}`);
			}

			HashMap<String, Double> patternMatchProbabilitiesForFrame = new HashMap<>();
			for (String patternName : patternMatchProbabilities.keySet())
				patternMatchProbabilitiesForFrame.put(patternName, patternMatchProbabilities.get(patternName).get(currentX));
			/*for (let listener of LL.scripts.scriptRunner.listeners_onUpdatePatternMatchProbabilities)
				listener(patternMatchProbabilitiesForFrame);*/

			chartManager.OnSetPatternMatchProbabilities(currentX, patternMatchProbabilitiesForFrame);

			Main.main.SendEvent("OnSetPatternMatchProbabilities", currentX, V.ToWritableMap(patternMatchProbabilitiesForFrame));
		}
		else {
			/*let lastPatternMatchProbability = null;
			for (let x = currentX; x >= 0 && lastPatternMatchProbability == null; x++)
				lastPatternMatchProbability = patternMatchProbabilities.Props[0].value[x];
			if (lastPatternMatchProbability != null)
				JavaBridge.Main.OnSetPatternMatchProbability(lastPatternMatchProbability);*/
		}
	}
	List<Vector2i> GetPointsForScanRange(int channel, int scanLeft, int scanRight) {
		Vector2i[] channelPoints = EEGProcessor.this.channelPoints.get(channel);

		List<Vector2i> result = new ArrayList<>();
		for (int i = scanLeft; i < scanRight; i++) {
			int iFinal = i >= 0 ? i : ((maxX + 1) + i); // if in range, get it; else, loop around and grab from end
			result.add(channelPoints[iFinal]);
		}
		return result;
	}

	int GetChannelBaseline(int channel) {
		/*List<Vector2i> channelPoints = EEGProcessor.this.channelPoints.get(channel);
		List<Vector2i> channelPoints_ordered = V.List(Stream.of(channelPoints).sortBy(a->a.y));
		int result = channelPoints_ordered.get(channelPoints_ordered.size() / 2).y;
		//Log("Baseline:" + result + ";" + ToJSON(channelPoints_ordered));
		return result;*/

		/*Vector2i[] channelPoints = EEGProcessor.this.channelPoints.get(channel);
		int[] channelPoints_array = new int[channelPoints.length];
		for (int i = 0; i < channelPoints.length; i++)
			channelPoints_array[i] = channelPoints[i].y;
		Arrays.sort(channelPoints_array);*/

		Vector2i[] channelPoints = EEGProcessor.this.channelPoints.get(channel);
		Vector2i[] channelPoints_clone = channelPoints.clone();
		Arrays.sort(channelPoints_clone);

		int median;
		if (channelPoints_clone.length % 2 == 0)
			median = (channelPoints_clone[channelPoints_clone.length / 2].y + channelPoints_clone[channelPoints_clone.length / 2 - 1].y) / 2;
		else
			median = channelPoints_clone[channelPoints_clone.length / 2].y;
		return median;
	}

	/*static ConvertPoints(points) {
		var result = [];
		for (let point of points)
			result.push({x: point[0], y: point[1]});
		return result;
	}*/

	// essentially: points1.Select(a=>a.DistanceToClosestPointIn(points2)).Average();
	// NOTE: points2 must have each point's x-value be one greater than the one prior!
	static double GetAverageOfPointClosestDistances(List<Vector2i> points1, List<Vector2i> points2) {
		double pointClosestDistances_total = 0;

		int lastPoint_closestPoint2_index = -1;
		double lastPoint_closestPoint2_dist = Double.MAX_VALUE;
		for (int i = 0; i < points1.size(); i++) {
			Vector2i lastPoint1 = i > 0 ? points1.get(i - 1) : null;
			Vector2i point1 = points1.get(i);

			//double closestPoint2Dist = point.DistanceSquared(lastPoint_closestPoint2);
			int closestPoint2_index = lastPoint_closestPoint2_index;
			double closestPoint2_dist = lastPoint_closestPoint2_dist + (lastPoint1 != null ? lastPoint1.Distance(point1) : 0);
			int startX = lastPoint_closestPoint2_index;

			int offset = V.HasIndex(points2, startX + 1) ? 1 : -1;
			while (true) {
				int currentX = startX + offset;
				Vector2i point2 = points2.get(currentX);
				boolean closerPoint2IsPossible = V.Distance(currentX, point1.x) < closestPoint2_dist;
				if (!closerPoint2IsPossible) break;

				double dist = point1.Distance(point2);
				if (dist < closestPoint2_dist) {
					closestPoint2_index = currentX;
					closestPoint2_dist = dist;
				}

				offset = offset >= 0 ? -offset : -offset + 1;
				// if offset leads to invalid index, flip to the other side
				currentX = startX + offset;
				if (currentX < 0 || currentX >= points2.size())
					offset = -offset;
				// if still leads to invalid index, then break, as there's no more point2s
				if (currentX < 0 || currentX >= points2.size()) break;
			}

			lastPoint_closestPoint2_index = closestPoint2_index;
			lastPoint_closestPoint2_dist = closestPoint2_dist;

			pointClosestDistances_total += closestPoint2_dist;
		}

		double pointClosestDistances_average = pointClosestDistances_total / points1.size();
		return pointClosestDistances_average;
	}
	// Compute the Euclidean distance (as a crow flies) between two points.
	// Shortest distance between two pixels
	/*static double Distance(int x1, int y1, int x2, int y2) {
		return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
	}*/
}