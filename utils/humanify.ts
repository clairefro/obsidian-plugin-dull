function humanify(bytes: number): string {
	const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]; // Units in binary order
	let size = bytes;
	let unitIndex = 0;
	const TWO_TO_TEN = 2 ** 10;

	while (size >= TWO_TO_TEN && unitIndex < units.length - 1) {
		size /= TWO_TO_TEN;
		unitIndex++;
	}

	return `${size.toFixed(2)} ${units[unitIndex]}`;
}
export { humanify };
