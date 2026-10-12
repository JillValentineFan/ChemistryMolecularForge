/*
 * Assignment 4 - Question 1 (for version)
 * Author  : Ahmed Mohamed Fathi (F25SP2826), Section 31
 * Purpose : Display the sentence "I Love Programming" 30 times
 *           using a for loop.
 */
#include <iostream>
using namespace std;

int main()
{
    const int TIMES = 30;   // number of times to display the sentence

    // for: start, condition and update are written in one line
    for (int count = 1; count <= TIMES; count++)
    {
        cout << "I Love Programming" << endl;
    }

    return 0;
}
