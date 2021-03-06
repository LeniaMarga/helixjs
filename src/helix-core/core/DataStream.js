import {Endian} from "../utils/Endian";
import {Platform} from "../utils/Platform";

/**
 * @classdesc
 * DataStream is a wrapper for DataView which allows reading the data as a linear stream of data.
 * @param dataView the DataView object to read from.
 * @constructor
 *
 * @propety offset The current byte offset into the file.
 * @propety endian The endianness used by the data.
 *
 * @author derschmale <http://www.derschmale.com>
 */
function DataStream(dataView)
{
	this._dataView = dataView;
	this.offset = 0;
	this.endian = Endian.LITTLE_ENDIAN;
	this._hostEndian = Platform.endian;
	this.getUint8 = this.getUint8.bind(this);
	this.getUint16 = this.getUint16.bind(this);
	this.getUint32 = this.getUint32.bind(this);
	this.getInt8 = this.getInt8.bind(this);
	this.getInt16 = this.getInt16.bind(this);
	this.getInt32 = this.getInt32.bind(this);
	this.getFloat32 = this.getFloat32.bind(this);
	this.getFloat64 = this.getFloat64.bind(this);
}

DataStream.prototype =
	{
		/**
		 * The size of the data view in bytes.
		 */
		get byteLength () { return this._dataView.byteLength; },

		/**
		 * The amount of bytes still left in the file until EOF.
		 */
		get bytesAvailable() { return this._dataView.byteLength - this.offset; },

		/**
		 * Reads a single 8-bit string character from the stream.
		 */
		getChar: function()
		{
			return String.fromCharCode(this.getUint8());
		},

		/**
		 * Reads a single unsigned byte integer from the string.
		 */
		getUint8: function()
		{
			return this._dataView.getUint8(this.offset++);
		},

		/**
		 * Reads a single unsigned short integer from the string.
		 */
		getUint16: function()
		{
			var data = this._dataView.getUint16(this.offset, this.endian);
			this.offset += 2;
			return data;
		},

		/**
		 * Reads a single unsigned 32-bit integer from the string.
		 */
		getUint32: function()
		{
			var data = this._dataView.getUint32(this.offset, this.endian);
			this.offset += 4;
			return data;
		},

		/**
		 * Reads a single signed byte integer from the string.
		 */
		getInt8: function()
		{
			return this._dataView.getInt8(this.offset++);
		},

		/**
		 * Reads a single signed short integer from the string.
		 */
		getInt16: function()
		{
			var data = this._dataView.getInt16(this.offset, this.endian);
			this.offset += 2;
			return data;
		},

		/**
		 * Reads a single 32 bit integer from the string.
		 */
		getInt32: function()
		{
			var data = this._dataView.getInt32(this.offset, this.endian);
			this.offset += 4;
			return data;
		},

		/**
		 * Reads a 64-bit integer and stores it in a Number. The read value is not necessarily the same as what's stored, but
		 * may provide an acceptable approximation.
		 */
		getInt64AsFloat64: function()
		{
			var L, B;
			if (this.endian === Endian.LITTLE_ENDIAN) {
				L = this._dataView.getUint32(this.offset, this.endian);
				B = this._dataView.getInt32(this.offset + 4, this.endian);
			}
			else {
				B = this._dataView.getInt32(this.offset, this.endian);
				L = this._dataView.getUint32(this.offset + 4, this.endian);
			}
			this.offset += 8;
			return L + B * 4294967296.0;
		},

		/**
		 * Reads a half float.
		 */
		getFloat16: function()
		{
			var uint16 = this.getUint16();
			var signBit = uint16 >> 15;
			var expBits = (uint16 >> 10) & 0x1f;	// mask 5 bits
			var fracBits = uint16 & 0x3ff;	 		// mask 10 bits

			if (expBits === 0x1F)
				return 	fracBits? 	Number.NaN :
						signBit? 	Number.NEGATIVE_INFINITY :
									Number.POSITIVE_INFINITY;
			else if (expBits)
				return Math.pow(2, expBits - 15) * (1 + fracBits / 0x400);
			else
				return 6.103515625e-5 * (fracBits / 0x400);
		},

		/**
		 * Reads a single float.
		 */
		getFloat32: function()
		{
			var data = this._dataView.getFloat32(this.offset, this.endian);
			this.offset += 4;
			return data;
		},

		/**
		 * Reads a double float.
		 */
		getFloat64: function()
		{
			var data = this._dataView.getFloat64(this.offset, this.endian);
			this.offset += 8;
			return data;
		},

		/**
		 * Skips the offset into the buffer so it becomes aligned with the bytes. This allows reading data as a typed
		 * array more efficiently.
		 */
		skipAlign: function(bytes)
		{
			while (this.offset % bytes)
				++this.offset;
		},

		/**
		 * Reads an array of unsigned bytes.
		 *
		 * @param len The amount of elements to read.
		 */
		getUint8Array: function(len)
		{
			return this._readArray(len, Uint8Array, 1, this.getUint8);
		},

		/**
		 * Reads an array of unsigned shorts.
		 *
		 * @param len The amount of elements to read.
		 */
		getUint16Array: function(len)
		{
			return this._readArray(len, Uint16Array, 2, this.getUint16);
		},

		/**
		 * Reads an array of unsigned 32-bit integers.
		 *
		 * @param len The amount of elements to read.
		 */
		getUint32Array: function(len)
		{
			return this._readArray(len, Uint32Array, 4, this.getUint32);
		},

		/**
		 * Reads an array of signed bytes.
		 *
		 * @param len The amount of elements to read.
		 */
		getInt8Array: function(len)
		{
			return this._readArray(len, Int8Array, 1, this.getInt8);
		},

		/**
		 * Reads an array of signed shorts.
		 *
		 * @param len The amount of elements to read.
		 */
		getInt16Array: function(len)
		{
			return this._readArray(len, Int16Array, 2, this.getInt16);
		},

		/**
		 * Reads an array of signed 32-bit integers.
		 *
		 * @param len The amount of elements to read.
		 */
		getInt32Array: function(len)
		{
			return this._readArray(len, Int32Array, 4, this.getInt32);
		},

		/**
		 * Reads an array of 64-bit integers into floats.
		 *
		 * @param len The amount of elements to read.
		 */
		getInt64AsFloat64Array: function(len)
		{
			var arr = new Float64Array(len);

			for (var i = 0; i < len; ++i)
				arr[i] = this.getInt64AsFloat64();

			return arr;
		},

		/**
		 * Reads an array of single floats.
		 *
		 * @param len The amount of elements to read.
		 */
		getFloat32Array: function(len)
		{
			return this._readArray(len, Float32Array, 4, this.getFloat32);
		},

		/**
		 * Reads an array of half floats.
		 *
		 * @param len The amount of elements to read.
		 */
		getFloat16Array: function(len)
		{
			var arr = new Float32Array(len);

			for (var i = 0; i < len; ++i)
				arr[i] = this.getFloat16();

			return arr;
		},

		/**
		 * Reads an array of double floats.
		 *
		 * @param len The amount of elements to read.
		 */
		getFloat64Array: function(len)
		{
			return this._readArray(len, Float64Array, 8, this.getFloat64);
		},

		/**
		 * Reads a string.
		 *
		 * @param [len] The amount of characters in the string. If omitted, it reads until (and including) it encounters a "\0" character.
		 */
		getString: function(len)
		{
			if (!len) return this._get0String();

			var str = "";

			for (var i = 0; i < len; ++i)
				str += this.getChar();

			return str;
		},

		/**
		 * @ignore
		 */
		_get0String: function()
		{
			var str = "";

			do {
				var ch = this.getUint8();
				if (ch) str += String.fromCharCode(ch);
			} while (ch !== 0);

			return str;
		},

		/**
		 * @ignore
		 */
		_readArray: function(len, arrayType, elmSize, readFunc)
		{
		    if (this.offset % elmSize === 0 && this.endian === this._hostEndian) {
				var arr = new arrayType(this._dataView.buffer, this.offset, len);
				this.offset += len * elmSize;
				return arr;
			}

			var arr = new arrayType(len);

			for (var i = 0; i < len; ++i)
				arr[i] = readFunc();

			return arr;
		}
	};

export { DataStream };